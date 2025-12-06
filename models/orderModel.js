const mongoose = require("mongoose");

const orderSchema = mongoose.Schema(
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
    full_name: {
      type: String,
      required: true,
      trim: true,
    },
    products: [
      {
        product_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
          default: 1,
        },
        selected_image: {
          type: String,
          required: false,
        },
        selected_size: {
          type: String,
          required: false,
        },
      },
    ],
    total_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    original_amount: {
      type: Number,
      required: true,
      min: 0,
    },
    shipping_amount: {
      type: Number,
      required: true,
      default: 0,
    },
    discount_applied: {
      type: Boolean,
      default: false,
    },
    discount_code: {
      type: String,
      required: false,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    payment_status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed",
    },
    shipping_address: {
      type: String,
      required: true,
      trim: true,
    },
    order_email: {
      type: String,
      required: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email"],
    },
    phone_number: {
      type: String,
      required: true,
      trim: true,
      // Accept either local 11-digit numbers (e.g. 03001234567) or international +92XXXXXXXXXX
      match: [
        /^(?:\+92\d{10}|\d{11})$/,
        "Please provide a valid phone number (11 digits or +92XXXXXXXXXX)",
      ],
    },
    city: {
      type: String,
      required: false,
      trim: true,
    },
  },
  { timestamps: true }
);

// Index for better query performance
orderSchema.index({ user_id: 1 });
orderSchema.index({ guest_id: 1 });
orderSchema.index({ order_email: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Order", orderSchema);
