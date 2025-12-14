// models/wishlistModel.js
const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    guest_id: {
      type: String,
      required: false,
    },
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    selected_image: {
      type: String,
      required: true,
    },
    selected_size: {
      type: String,
      required: false,
    },
  },
  { timestamps: true }
);

// Ensure one product per user/guest with same variant
wishlistSchema.index(
  { user_id: 1, product_id: 1, selected_image: 1, selected_size: 1 },
  { unique: true }
);
wishlistSchema.index(
  { guest_id: 1, product_id: 1, selected_image: 1, selected_size: 1 },
  { unique: true }
);

module.exports = mongoose.model("Wishlist", wishlistSchema);
