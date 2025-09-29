const mongoose = require("mongoose");

const productSchema = mongoose.Schema(
  {
    product_name: {
      type: String,
      required: true,
    },
    product_description: {
      type: String,
      required: true,
    },
    product_base_price: {
      type: Number,
      required: true,
    },
    product_discounted_price: {
      type: Number,
      required: true,
    },
    product_stock: {
      type: Number,
      required: true,
      default: 0,
    },
    sizes: [
      {
        size: {
          type: String,
          enum: ["S", "M", "L", "XL"],
          required: true,
        },
        stock: {
          type: Number,
          required: true,
          default: 0,
        },
      },
    ],
    warranty: {
      type: String,
      required: false,
      default: "",
    },
    product_images: {
      type: Array,
      required: true,
      default: [],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },
    subcategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    brand_name: {
      type: String,
      required: true,
    },
    product_code: {
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
    bg_color: {
      type: String,
      required: false,
      default: "#FFFFFF",
    },
    shipping: {
      type: Number,
      required: true,
      default: 0,
    },
    payment: {
      type: [String],
      required: true,
      default: ["Cash on Delivery"],
    },
    isNewArrival: {
      type: Boolean,
      required: false,
      default: false,
    },
    isBestSeller: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Product", productSchema);