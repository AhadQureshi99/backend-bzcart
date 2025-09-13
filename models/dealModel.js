const mongoose = require("mongoose");

const dealSchema = mongoose.Schema(
  {
    deal_name: {
      type: String,
      required: true,
    },
    deal_description: {
      type: String,
      required: true,
    },
    original_price: {
      type: Number,
      required: true,
    },
    deal_price: {
      type: Number,
      required: true,
    },
    deal_stock: {
      type: Number,
      required: true,
      default: 0,
    },
    deal_images: {
      type: Array,
      required: true,
      default: [],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    deal_code: {
      type: String,
      required: true,
      unique: true,
    },
    rating: {
      type: Number,
      required: false,
      default: 4,
    },
    reviews: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
      },
    ],
    deal_expiry: {
      type: Date,
      required: true,
    },
    bg_color: {
      type: String,
      required: false,
      default: "#FFFFFF",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Deal", dealSchema);
