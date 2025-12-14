const handler = require("express-async-handler");
const Activity = require("../models/activityModel");
const mongoose = require("mongoose");

// POST /api/analytics/event
const logEvent = handler(async (req, res) => {
  const payload = req.body || {};
  try {
    if (
      process.env.NODE_ENV !== "production" &&
      typeof console !== "undefined"
    ) {
      try {
        console.debug &&
          console.debug(
            "analyticsController.logEvent - incoming payload:",
            JSON.stringify(payload)
          );
      } catch (e) {
        console.debug &&
          console.debug("analyticsController.logEvent - payload", payload);
      }
    }
  } catch (e) {}
  // allow either user_id in body or from auth
  const user_id = req.user?.id || payload.user_id || null;
  const eventType = payload.event_type;

  if (!eventType) {
    res.status(400);
    throw new Error("event_type is required");
  }

  // attach request IP to meta when available (use helper that checks common proxy headers)
  const { getClientIp } = require("../utils/getClientIp");
  const ip = getClientIp(req);
  payload.meta = payload.meta || {};
  if (ip) payload.meta.ip = ip;

  // Best-effort: attach parsed UA fields into meta when available so events
  // include os_name/os_version/device_model/device_type for the dashboard.
  try {
    const { parseUA } = require("../utils/uaParser");
    const uaHeader = req.headers["user-agent"] || null;
    if (uaHeader) {
      const parsed = parseUA(uaHeader);
      payload.meta.ua = payload.meta.ua || parsed.ua || uaHeader;
      if (parsed.os_name)
        payload.meta.os_name = payload.meta.os_name || parsed.os_name;
      if (parsed.os_version)
        payload.meta.os_version = payload.meta.os_version || parsed.os_version;
      if (parsed.device_model)
        payload.meta.device_model =
          payload.meta.device_model || parsed.device_model;
      if (parsed.device_type)
        payload.meta.device_type =
          payload.meta.device_type || parsed.device_type;
    }
  } catch (e) {
    // ignore UA parse errors
  }

  // If this is a page view for a checkout/payment page, attach a server-side
  // cart snapshot (best-effort) so the dashboard can inspect what the user had
  // in their cart when they reached checkout / cashout.
  try {
    const urlLower = String(payload.url || payload.path || "").toLowerCase();
    if (
      eventType === "page_view" &&
      /cashout|checkout|payment/.test(urlLower)
    ) {
      try {
        const Cart = require("../models/cartModel");
        const cartQuery = user_id
          ? { user_id }
          : payload.guest_id
          ? { guest_id: String(payload.guest_id) }
          : null;
        if (cartQuery) {
          const cartItems = await Cart.find(cartQuery).populate("product_id");
          if (cartItems && cartItems.length) {
            // Build a minimal snapshot compatible with other server logs
            payload.data = payload.data || {};
            payload.data.cart_snapshot = cartItems.map((it) => {
              const prod = it.product_id || {};
              // choose selected image only if it legitimately belongs to the product
              let sel = it.selected_image || null;
              if (
                sel &&
                Array.isArray(prod.product_images) &&
                !prod.product_images.includes(sel)
              ) {
                sel =
                  Array.isArray(prod.product_images) &&
                  prod.product_images.length
                    ? prod.product_images[0]
                    : sel;
              }
              return {
                _id: it._id,
                product_id: it.product_id?._id || it.product_id,
                product_name: it.product_id?.product_name || null,
                selected_image: sel || null,
                selected_size: it.selected_size || null,
                quantity: it.quantity || 0,
                price:
                  it.product_id?.product_discounted_price ||
                  it.product_id?.product_base_price ||
                  null,
              };
            });
          }
        }
      } catch (e) {
        // Best-effort only — do not fail event logging if cart lookup fails
        console.warn(
          "analyticsController: failed to attach cart snapshot",
          e?.message || e
        );
      }
    }
  } catch (e) {
    /* ignore general failures in this enrichment step */
  }

  // Mark first-time page views: if this is the user's/guest's first activity
  // ever, annotate the payload so the dashboard can treat them as "unique".
  try {
    if (eventType === "page_view") {
      let isFirst = false;
      if (user_id) {
        const exists = await Activity.findOne({ user_id: user_id })
          .select("_id")
          .lean();
        if (!exists) isFirst = true;
      } else if (payload.guest_id) {
        const exists = await Activity.findOne({
          guest_id: String(payload.guest_id),
        })
          .select("_id")
          .lean();
        if (!exists) isFirst = true;
      }
      if (isFirst) {
        payload.meta = payload.meta || {};
        payload.meta.first_visit = true;
      }
    }
  } catch (e) {
    // best-effort only; do not fail logging on this
  }

  let doc;
  try {
    doc = await Activity.create({
      user_id:
        user_id && mongoose.Types.ObjectId.isValid(user_id) ? user_id : null,
      guest_id: payload.guest_id || null,
      user_display: payload.user_display || null,
      session_id: payload.session_id || null,
      event_type: eventType,
      url: payload.url || payload.path || null,
      element: payload.element || null,
      data: payload.data || {},
      duration_ms: payload.duration_ms || null,
      meta: payload.meta || {},
    });
  } catch (e) {
    // Log the error details to aid debugging when ingestion fails
    console.error(
      "analyticsController.logEvent - Activity.create failed:",
      e?.message || e
    );
    console.error("Payload:", JSON.stringify(payload).slice(0, 2000));
    // rethrow so express-async-handler/error middleware will produce a 500
    throw e;
  }

  // Try to enrich geolocation synchronously with a short timeout so the
  // Activity returned to the API caller contains location when possible.
  if (ip) {
    try {
      const url = `https://ipapi.co/${ip}/json/`;
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 1000);
      let updated = null;
      try {
        const r = await fetch(url, { signal: controller.signal });
        clearTimeout(t);
        if (r && r.ok) {
          const info = await r.json();
          const loc = {
            ip: ip,
            city: info.city || null,
            region: info.region || null,
            country: info.country_name || info.country || null,
            latitude: info.latitude || info.lat || null,
            longitude: info.longitude || info.lon || null,
            org: info.org || null,
          };
          updated = await Activity.findByIdAndUpdate(
            doc._id,
            { $set: { "meta.location": loc } },
            { new: true }
          );
        }
      } catch (e) {
        // ignored (timeout/network)
      }
      return res.status(201).json(updated || doc);
    } catch (err) {
      return res.status(201).json(doc);
    }
  }

  return res.status(201).json(doc);
});

// GET /api/analytics/monthly - monthly breakdown with user cohorts (unique/returning/registered)
const monthlyStats = handler(async (req, res) => {
  const now = new Date();
  // Go back 12 months
  const start = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 365);
  const THREE_HOURS = 1000 * 60 * 60 * 3;

  // Collect ordered timestamps per guest (all time, not just window)
  const guestTimesAgg = await Activity.aggregate([
    { $match: { guest_id: { $exists: true, $ne: null } } },
    { $sort: { guest_id: 1, createdAt: 1 } },
    { $group: { _id: "$guest_id", times: { $push: "$createdAt" } } },
    {
      $project: {
        first: { $arrayElemAt: ["$times", 0] },
        second: { $arrayElemAt: ["$times", 1] },
      },
    },
  ]);
  const guestTimesMap = {};
  guestTimesAgg.forEach((g) => {
    guestTimesMap[g._id] = {
      first: g.first ? new Date(g.first) : null,
      second: g.second ? new Date(g.second) : null,
    };
  });

  // For registered users: similar collection
  const userTimesAgg = await Activity.aggregate([
    { $match: { user_id: { $exists: true, $ne: null } } },
    { $sort: { user_id: 1, createdAt: 1 } },
    { $group: { _id: "$user_id", times: { $push: "$createdAt" } } },
    {
      $project: {
        first: { $arrayElemAt: ["$times", 0] },
        second: { $arrayElemAt: ["$times", 1] },
      },
    },
  ]);
  const userTimesMap = {};
  userTimesAgg.forEach((u) => {
    userTimesMap[String(u._id)] = {
      first: u.first ? new Date(u.first) : null,
      second: u.second ? new Date(u.second) : null,
    };
  });

  // Get all activities in 12-month window, grouped by month
  const monthlyAgg = await Activity.aggregate([
    { $match: { createdAt: { $gte: start } } },
    {
      $project: {
        month: {
          $dateToString: { format: "%Y-%m", date: "$createdAt" },
        },
        guest_id: 1,
        user_id: 1,
        event_type: 1,
      },
    },
  ]);

  // Group by month and collect unique guests/users per month
  const monthlyData = {};
  monthlyAgg.forEach((rec) => {
    const month = rec.month;
    if (!monthlyData[month]) {
      monthlyData[month] = {
        guests: new Set(),
        users: new Set(),
        add_to_cart: 0,
        order_placed: 0,
        page_view: 0,
      };
    }
    if (rec.guest_id) monthlyData[month].guests.add(rec.guest_id);
    if (rec.user_id) monthlyData[month].users.add(String(rec.user_id));
    if (rec.event_type === "add_to_cart") monthlyData[month].add_to_cart++;
    if (rec.event_type === "order_placed") monthlyData[month].order_placed++;
    if (rec.event_type === "page_view") monthlyData[month].page_view++;
  });

  // For each month, classify guests and users by cohort (unique/returning/registered new/registered returning)
  const monthlyBreakdown = {};
  Object.keys(monthlyData)
    .sort()
    .forEach((month) => {
      const data = monthlyData[month];
      const guestIds = Array.from(data.guests);
      const userIds = Array.from(data.users);

      let uniqueGuests = 0;
      let returningGuests = 0;
      let registeredNew = 0;
      let registeredReturning = 0;
      const uniqueGuestIds = [];
      const returningGuestIds = [];
      const registeredNewIds = [];
      const registeredReturningIds = [];

      guestIds.forEach((gid) => {
        const times = guestTimesMap[gid] || {};
        const first = times.first;
        const second = times.second;
        // if first seen in this month and no second after 3 hours -> unique
        const monthStart = new Date(month + "-01");
        const monthEnd = new Date(
          new Date(monthStart).setMonth(monthStart.getMonth() + 1)
        );
        if (first && first >= monthStart && first < monthEnd) {
          if (!second || second.getTime() <= first.getTime() + THREE_HOURS) {
            uniqueGuests++;
            if (uniqueGuestIds.length < 100) uniqueGuestIds.push(gid);
          } else {
            returningGuests++;
            if (returningGuestIds.length < 100) returningGuestIds.push(gid);
          }
        } else if (first && first < monthStart) {
          returningGuests++;
          if (returningGuestIds.length < 100) returningGuestIds.push(gid);
        }
      });

      userIds.forEach((uid) => {
        const times = userTimesMap[uid] || {};
        const first = times.first;
        const second = times.second;
        const monthStart = new Date(month + "-01");
        const monthEnd = new Date(
          new Date(monthStart).setMonth(monthStart.getMonth() + 1)
        );
        if (first && first >= monthStart && first < monthEnd) {
          if (!second || second.getTime() <= first.getTime() + THREE_HOURS) {
            registeredNew++;
            if (registeredNewIds.length < 100) registeredNewIds.push(uid);
          } else {
            registeredReturning++;
            if (registeredReturningIds.length < 100)
              registeredReturningIds.push(uid);
          }
        } else if (first && first < monthStart) {
          registeredReturning++;
          if (registeredReturningIds.length < 100)
            registeredReturningIds.push(uid);
        }
      });

      monthlyBreakdown[month] = {
        unique_guests: uniqueGuests,
        returning_guests: returningGuests,
        registered_new: registeredNew,
        registered_returning: registeredReturning,
        unique_guest_ids: uniqueGuestIds,
        returning_guest_ids: returningGuestIds,
        registered_new_ids: registeredNewIds,
        registered_returning_ids: registeredReturningIds,
        add_to_cart: data.add_to_cart,
        order_placed: data.order_placed,
        page_view: data.page_view,
      };
    });

  // Load user info for sample registered user ids (new + returning)
  const registeredUserMap = {};
  try {
    const User = require("../models/userModel");
    const allRegIds = Object.values(monthlyBreakdown)
      .flatMap((m) => [...m.registered_new_ids, ...m.registered_returning_ids])
      .filter((id, idx, arr) => arr.indexOf(id) === idx); // unique
    if (allRegIds.length) {
      const users = await User.find({ _id: { $in: allRegIds } }).select(
        "_id username email"
      );
      users.forEach((u) => {
        registeredUserMap[String(u._id)] = {
          username: u.username,
          email: u.email,
        };
      });
    }
  } catch (e) {
    // ignore
  }

  res
    .status(200)
    .json({ breakdown: monthlyBreakdown, user_map: registeredUserMap });
});

// GET /api/analytics/events
const getEvents = handler(async (req, res) => {
  // optional filters: user_id, guest_id, event_type, start, end, limit, skip
  const {
    user_id,
    guest_id,
    event_type,
    start,
    end,
    limit = 200,
    skip = 0,
  } = req.query;
  const q = {};
  if (user_id && mongoose.Types.ObjectId.isValid(user_id)) q.user_id = user_id;
  // support guest_id (string) for anonymous visitor filtering
  if (guest_id) q.guest_id = String(guest_id);
  if (event_type) q.event_type = event_type;
  if (start || end) q.createdAt = {};
  if (start) q.createdAt.$gte = new Date(start);
  if (end) q.createdAt.$lte = new Date(end);

  const results = await Activity.find(q)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .skip(Number(skip));

  return res.status(200).json(results);
});

// GET /api/analytics/summary
const getSummary = handler(async (req, res) => {
  // Simple aggregation: counts by event_type, unique users, average session duration
  const pipeline = [
    {
      $facet: {
        countsByType: [{ $sortByCount: "$event_type" }, { $limit: 50 }],
        uniqueUsers: [
          { $match: { user_id: { $ne: null } } },
          { $group: { _id: "$user_id" } },
          { $count: "uniqueUsers" },
        ],
        sessionDurations: [
          {
            $match: {
              event_type: "session_end",
              duration_ms: { $exists: true },
            },
          },
          {
            $group: {
              _id: null,
              avgDuration: { $avg: "$duration_ms" },
              count: { $sum: 1 },
            },
          },
        ],
      },
    },
  ];

  const agg = await Activity.aggregate(pipeline);
  const data = agg[0] || {};

  res.status(200).json({
    countsByType: data.countsByType || [],
    uniqueUsers: data.uniqueUsers?.[0]?.uniqueUsers || 0,
    avgSessionDurationMs: data.sessionDurations?.[0]?.avgDuration || 0,
    sessionSamples: data.sessionDurations?.[0]?.count || 0,
  });
});

// GET /api/analytics/weekly - last-7-days metrics split by unique/visitors/registered
// Classification rule: a visitor is considered "unique" for their first visit; if they
// come back later after a >3 hour gap from their first visit, they are treated as a returning visitor.
const weeklyStats = handler(async (req, res) => {
  const now = new Date();
  const start = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 7); // 7 days
  const THREE_HOURS = 1000 * 60 * 60 * 3;

  // For guests: collect ordered timestamps per guest (sorted) and derive first/second
  const guestTimesAgg = await Activity.aggregate([
    { $match: { guest_id: { $exists: true, $ne: null } } },
    { $sort: { guest_id: 1, createdAt: 1 } },
    { $group: { _id: "$guest_id", times: { $push: "$createdAt" } } },
    {
      $project: {
        first: { $arrayElemAt: ["$times", 0] },
        second: { $arrayElemAt: ["$times", 1] },
      },
    },
  ]);
  const guestTimesMap = {};
  guestTimesAgg.forEach((g) => {
    guestTimesMap[g._id] = {
      first: g.first ? new Date(g.first) : null,
      second: g.second ? new Date(g.second) : null,
    };
  });

  // For registered users: similar collection
  const userTimesAgg = await Activity.aggregate([
    { $match: { user_id: { $exists: true, $ne: null } } },
    { $sort: { user_id: 1, createdAt: 1 } },
    { $group: { _id: "$user_id", times: { $push: "$createdAt" } } },
    {
      $project: {
        first: { $arrayElemAt: ["$times", 0] },
        second: { $arrayElemAt: ["$times", 1] },
      },
    },
  ]);
  const userTimesMap = {};
  userTimesAgg.forEach((u) => {
    userTimesMap[String(u._id)] = {
      first: u.first ? new Date(u.first) : null,
      second: u.second ? new Date(u.second) : null,
    };
  });

  // Active guest ids in the window
  const activeGuestsAgg = await Activity.aggregate([
    {
      $match: {
        createdAt: { $gte: start },
        guest_id: { $exists: true, $ne: null },
      },
    },
    { $group: { _id: "$guest_id" } },
  ]);
  const activeGuestIds = activeGuestsAgg.map((r) => r._id);

  let uniqueGuests = 0;
  let returningGuests = 0;
  const uniqueGuestIds = [];
  const returningGuestIds = [];

  activeGuestIds.forEach((gid) => {
    const times = guestTimesMap[gid] || {};
    const first = times.first;
    const second = times.second;
    // if first seen in window and no second after 3 hours -> unique
    if (first && first >= start) {
      if (!second || second.getTime() <= first.getTime() + THREE_HOURS) {
        uniqueGuests++;
        if (uniqueGuestIds.length < 200) uniqueGuestIds.push(gid);
      } else {
        returningGuests++;
        if (returningGuestIds.length < 200) returningGuestIds.push(gid);
      }
    } else {
      returningGuests++;
      if (returningGuestIds.length < 200) returningGuestIds.push(gid);
    }
  });

  // Active registered users in the window
  const activeUsersAgg = await Activity.aggregate([
    {
      $match: {
        createdAt: { $gte: start },
        user_id: { $exists: true, $ne: null },
      },
    },
    { $group: { _id: "$user_id" } },
  ]);
  const activeUserIds = activeUsersAgg.map((r) => String(r._id));
  let registeredNew = 0;
  let registeredReturning = 0;
  const registeredNewIds = [];
  const registeredReturningIds = [];

  activeUserIds.forEach((uid) => {
    const times = userTimesMap[uid] || {};
    const first = times.first;
    const second = times.second;
    if (first && first >= start) {
      if (!second || second.getTime() <= first.getTime() + THREE_HOURS) {
        registeredNew++;
        if (registeredNewIds.length < 200) registeredNewIds.push(uid);
      } else {
        registeredReturning++;
        if (registeredReturningIds.length < 200)
          registeredReturningIds.push(uid);
      }
    } else {
      registeredReturning++;
      if (registeredReturningIds.length < 200) registeredReturningIds.push(uid);
    }
  });

  // Attempt to resolve guest -> user mapping when a guest later signs up (best-effort)
  const guestUserMap = {};
  try {
    const User = require("../models/userModel");
    // For each sample guest id, try to find any activity record that later contains a user_id
    const sampleGuestIds = [...uniqueGuestIds, ...returningGuestIds];
    if (sampleGuestIds.length) {
      // find activities for these guests where user_id exists
      const linkActs = await Activity.find({
        guest_id: { $in: sampleGuestIds },
        user_id: { $ne: null },
      })
        .limit(500)
        .lean();
      const userIdsToLoad = Array.from(
        new Set(linkActs.map((a) => String(a.user_id)).filter(Boolean))
      );
      let usersById = {};
      if (userIdsToLoad.length) {
        const users = await User.find({ _id: { $in: userIdsToLoad } }).select(
          "_id username email"
        );
        usersById = users.reduce((acc, u) => {
          acc[String(u._id)] = { username: u.username, email: u.email };
          return acc;
        }, {});
      }
      linkActs.forEach((a) => {
        if (a.guest_id && a.user_id) {
          const uid = String(a.user_id);
          guestUserMap[a.guest_id] = usersById[uid] || { user_id: uid };
        }
      });
    }
  } catch (e) {
    // ignore failures
  }

  // Load user info for sample registered user ids (new + returning)
  const registeredUserMap = {};
  try {
    const User = require("../models/userModel");
    const allRegIds = Array.from(
      new Set([...registeredNewIds, ...registeredReturningIds])
    );
    if (allRegIds.length) {
      const users = await User.find({ _id: { $in: allRegIds } }).select(
        "_id username email"
      );
      users.forEach((u) => {
        registeredUserMap[String(u._id)] = {
          username: u.username,
          email: u.email,
        };
      });
    }
  } catch (e) {
    // ignore
  }

  // Events in window to classify add_to_cart and order_placed
  const eventsInWindow = await Activity.find({
    createdAt: { $gte: start },
    event_type: { $in: ["add_to_cart", "order_placed"] },
  }).lean();

  const counts = {
    unique: { add_to_cart: 0, order_placed: 0 },
    visitors: { add_to_cart: 0, order_placed: 0 },
    registered_new: { add_to_cart: 0, order_placed: 0 },
    registered_returning: { add_to_cart: 0, order_placed: 0 },
  };

  eventsInWindow.forEach((e) => {
    if (e.user_id) {
      const uid = String(e.user_id);
      const times = userTimesMap[uid] || {};
      const first = times.first;
      const second = times.second;
      if (
        first &&
        first >= start &&
        (!second || second.getTime() <= first.getTime() + THREE_HOURS)
      ) {
        counts.registered_new[e.event_type]++;
      } else {
        counts.registered_returning[e.event_type]++;
      }
    } else if (e.guest_id) {
      const gid = e.guest_id;
      const times = guestTimesMap[gid] || {};
      const first = times.first;
      const second = times.second;
      if (
        first &&
        first >= start &&
        (!second || second.getTime() <= first.getTime() + THREE_HOURS)
      ) {
        counts.unique[e.event_type]++;
      } else {
        counts.visitors[e.event_type]++;
      }
    }
  });

  res.status(200).json({
    period: { start, end: now },
    guests: {
      unique_count: uniqueGuests,
      returning_count: returningGuests,
      unique_ids: uniqueGuestIds,
      returning_ids: returningGuestIds,
      user_map: guestUserMap,
      breakdown: {
        unique: counts.unique,
        visitors: counts.visitors,
      },
    },
    registered: {
      active_count: activeUserIds.length,
      new_count: registeredNew,
      returning_count: registeredReturning,
      new_ids: registeredNewIds,
      returning_ids: registeredReturningIds,
      user_map: registeredUserMap,
      breakdown: {
        new: counts.registered_new,
        returning: counts.registered_returning,
      },
    },
  });
});

// GET /api/analytics/cart?guest_id=... OR ?user_id=...
// Returns cart items for the provided identifier (dashboard-only; protects via x-dashboard-secret header)
const getCartForActivity = handler(async (req, res) => {
  const { guest_id, user_id } = req.query;
  if (!guest_id && !user_id) {
    res.status(400);
    throw new Error("guest_id or user_id is required");
  }

  const Cart = require("../models/cartModel");

  const q = {};
  if (guest_id) q.guest_id = String(guest_id);
  else if (user_id && mongoose.Types.ObjectId.isValid(user_id))
    q.user_id = user_id;
  else if (user_id) {
    res.status(400);
    throw new Error("Invalid user_id");
  }

  const items = await Cart.find(q)
    .populate("product_id")
    .sort({ createdAt: -1 });
  res.status(200).json(items || []);
});

module.exports = {
  logEvent,
  getEvents,
  getSummary,
  monthlyStats,
  weeklyStats,
  getCartForActivity,
};
