const express = require("express");
const {
  logEvent,
  getEvents,
  getSummary,
} = require("../controllers/analyticsController");
const authHandler = require("../middlewares/authMiddleware");
const roleHandler = require("../middlewares/roleMiddleware");

const router = express.Router();

// Public event ingestion - allow anonymous events
router.post("/event", logEvent);

// Admin endpoints - for dashboard. Allow non-token (dummy) dashboard logins to access
// While these were originally protected, dashboard uses a dummy localStorage login.
// We intentionally expose GET endpoints for the dashboard UI (no token required).
// Allow protecting the dashboard endpoints with a simple secret header.
// If ANALYTICS_DASHBOARD_SECRET is set in env, requests must include
// the header `x-dashboard-secret: <secret>` to access the endpoints.
const dashboardSecret = process.env.ANALYTICS_DASHBOARD_SECRET;
const requireDashboardSecret = (req, res, next) => {
  if (!dashboardSecret) return next();
  const header = req.header("x-dashboard-secret");
  if (!header || header !== dashboardSecret) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
};

router.get("/events", requireDashboardSecret, getEvents);
router.get("/summary", requireDashboardSecret, getSummary);
router.get(
  "/cart",
  requireDashboardSecret,
  require("../controllers/analyticsController").getCartForActivity
);

module.exports = router;
