const handler = require("express-async-handler");
const Activity = require("../models/activityModel");
const mongoose = require("mongoose");

// POST /api/analytics/event
const logEvent = handler(async (req, res) => {
  const payload = req.body || {};
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

  const doc = await Activity.create({
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

// GET /api/analytics/monthly - simple last-30-days metrics (page_views, add_to_cart, order_placed)
const monthlyStats = handler(async (req, res) => {
  const now = new Date();
  const start = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30); // 30 days ago

  // counts per day for the last 30 days
  const pipeline = [
    { $match: { createdAt: { $gte: start } } },
    {
      $project: {
        day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        event_type: 1,
      },
    },
    {
      $group: {
        _id: { day: "$day", event: "$event_type" },
        count: { $sum: 1 },
      },
    },
  ];

  const agg = await Activity.aggregate(pipeline);

  // reduce into easy maps
  const byDay = {};
  agg.forEach((r) => {
    const d = r._id.day;
    const e = r._id.event;
    byDay[d] = byDay[d] || { page_view: 0, add_to_cart: 0, order_placed: 0 };
    if (e === "page_view") byDay[d].page_view = r.count;
    if (e === "add_to_cart") byDay[d].add_to_cart = r.count;
    if (e === "order_placed") byDay[d].order_placed = r.count;
  });

  // totals for last 30 days
  const totals = { page_view: 0, add_to_cart: 0, order_placed: 0 };
  Object.values(byDay).forEach((v) => {
    totals.page_view += v.page_view || 0;
    totals.add_to_cart += v.add_to_cart || 0;
    totals.order_placed += v.order_placed || 0;
  });

  // compute unique sessions (visitors) per day
  const pvPipeline = [
    { $match: { createdAt: { $gte: start }, event_type: "page_view" } },
    {
      $project: {
        day: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        session_id: "$session_id",
      },
    },
    { $group: { _id: { day: "$day", session: "$session_id" } } },
    { $group: { _id: "$_id.day", uniqueSessions: { $sum: 1 } } },
  ];
  const pvAgg = await Activity.aggregate(pvPipeline);
  const visitorsByDay = {};
  pvAgg.forEach((r) => {
    visitorsByDay[r._id] = r.uniqueSessions || 0;
  });

  // add visitors per day into byDay structure
  Object.keys(byDay).forEach((d) => {
    byDay[d].visitors = visitorsByDay[d] || 0;
  });

  // include visitors total
  totals.visitors = Object.values(byDay).reduce(
    (s, v) => s + (v.visitors || 0),
    0
  );

  res.status(200).json({ totals, byDay });
});

// GET /api/analytics/events
const getEvents = handler(async (req, res) => {
  // optional filters: user_id, event_type, start, end, limit, skip
  const { user_id, event_type, start, end, limit = 200, skip = 0 } = req.query;
  const q = {};
  if (user_id && mongoose.Types.ObjectId.isValid(user_id)) q.user_id = user_id;
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
  getCartForActivity,
};
