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

// Admin endpoints - protected
router.get("/events", authHandler, roleHandler(["superadmin", "admin", "team"]), getEvents);
router.get("/summary", authHandler, roleHandler(["superadmin", "admin", "team"]), getSummary);

module.exports = router;
