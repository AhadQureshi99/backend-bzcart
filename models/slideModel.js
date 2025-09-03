const mongoose = require("mongoose");

const slideSchema = new mongoose.Schema({
  title: { type: String },
  subtitle: { type: String },
  buttonText: { type: String },
  image: { type: String, required: true }, // Desktop image
  mobileImage: { type: String }, // Mobile image
  link: { type: String, default: "/products" },
  bgColor: { type: String, default: "#ffffff" },
  size: { type: String, enum: ["medium", "large"], default: "medium" }, // Match your select options
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Slide", slideSchema);