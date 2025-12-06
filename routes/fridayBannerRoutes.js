const express = require("express");
const multer = require("multer");
const {
  createBanner,
  getBanner,
  deleteBanner,
} = require("../controllers/fridayBannerController");

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
}).fields([
  { name: "image", maxCount: 1 },
  { name: "video", maxCount: 1 },
]);

router.post("/", upload, createBanner);
router.get("/", getBanner);
router.delete("/:id", deleteBanner);

module.exports = router;
