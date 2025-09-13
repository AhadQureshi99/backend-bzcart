const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  parent_category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    default: null,
  },
  subcategories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
  image: { type: String, default: "" }, // Single image URL
});

module.exports = mongoose.model("Category", categorySchema);