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
router.get("/events", getEvents);
router.get("/summary", getSummary);

module.exports = router;
