const mongoose = require("mongoose");

const slideSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: { type: String, required: true },
  buttonText: { type: String, required: true },
  image: { type: String, required: true },
  link: { type: String, default: "/products" },
  background: { type: String }, // Optional field for background image URL
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Slide", slideSchema);