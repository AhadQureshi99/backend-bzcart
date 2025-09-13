const express = require("express");
const {
  createReel,
  getReels,
  getReelById,
  deleteReel,
} = require("../controllers/reelController");
const authHandler = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/reels", getReels); // Public access
router.get("/reel/:id", getReelById); // Public access
router.post("/create-reel",  createReel); // Protected route
router.delete("/reel/:id", deleteReel); // Protected route

module.exports = router;
