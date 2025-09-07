const mongoose = require("mongoose");

const slideSchema = new mongoose.Schema({
  title: { type: String },
  subtitle: { type: String },
  buttonText: { type: String },
  image: { type: String, required: true }, // Desktop image
  mobileImage: { type: String }, // Mobile image
  link: { type: String, default: "/products" },
  bgColor: { type: String, default: "#ffffff" },
  titleColor: { type: String, default: "#000000" },
  subtitleColor: { type: String, default: "#000000" },
  buttonBgColor: { type: String, default: "#ffffff" },
  buttonTextColor: { type: String, default: "#000000" },
  size: { type: String, enum: ["small", "medium", "large"], default: "medium" },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Slide", slideSchema);