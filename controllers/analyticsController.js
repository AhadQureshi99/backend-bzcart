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

  const doc = await Activity.create({
    user_id: user_id && mongoose.Types.ObjectId.isValid(user_id) ? user_id : null,
    guest_id: payload.guest_id || null,
    session_id: payload.session_id || null,
    event_type: eventType,
    url: payload.url || payload.path || null,
    element: payload.element || null,
    data: payload.data || {},
    duration_ms: payload.duration_ms || null,
    meta: payload.meta || {},
  });

  res.status(201).json(doc);
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
        countsByType: [
          { $sortByCount: "$event_type" },
          { $limit: 50 },
        ],
        uniqueUsers: [
          { $match: { user_id: { $ne: null } } },
          { $group: { _id: "$user_id" } },
          { $count: "uniqueUsers" },
        ],
        sessionDurations: [
          { $match: { event_type: "session_end", duration_ms: { $exists: true } } },
          { $group: { _id: null, avgDuration: { $avg: "$duration_ms" }, count: { $sum: 1 } } },
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

module.exports = {
  logEvent,
  getEvents,
  getSummary,
};
