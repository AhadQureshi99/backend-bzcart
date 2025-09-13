const mongoose = require("mongoose");

const brandSchema = new mongoose.Schema({
  image: {
    type: String,
    required: [true, "Brand image is required"],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Brand", brandSchema);