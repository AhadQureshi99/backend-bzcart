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

  // attach request IP to meta when available
  const ip =
    req.headers["x-forwarded-for"]?.split(",")?.[0]?.trim() || req.ip || null;
  payload.meta = payload.meta || {};
  if (ip) payload.meta.ip = ip;

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

  res.status(201).json(doc);

  // Socket-based realtime updates removed — analytics will be served via REST

  // Non-blocking: enrich the doc with geo lookup based on IP when available (best-effort)
  (async () => {
    try {
      if (ip) {
        // Using ipapi.co (no-key, rate limits); if unavailable this fails silently
        const url = `https://ipapi.co/${ip}/json/`;
        const r = await fetch(url, { timeout: 2000 });
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
          const updated = await Activity.findByIdAndUpdate(
            doc._id,
            { $set: { "meta.location": loc } },
            { new: true }
          );
          // removed socket.io emission; REST endpoint serves updated events
        }
      }
    } catch (err) {
      // ignore geolocation errors
    }
  })();
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

  res.status(200).json(results);
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
