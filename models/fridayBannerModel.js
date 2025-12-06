const mongoose = require("mongoose");

const fridayBannerSchema = new mongoose.Schema(
  {
    image: {
      type: String,
      required: false,
    },
    video: {
      type: String,
      required: false,
    },
    title: {
      type: String,
      required: false,
    },
    buttonText: {
      type: String,
      required: false,
    },
    buttonLink: {
      type: String,
      required: false,
    },
    timer: {
      type: String, // ISO format "2025-12-25T23:59:00"
      required: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("FridayBanner", fridayBannerSchema);
