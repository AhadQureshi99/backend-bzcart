const mongoose = require("mongoose");

const orderSchema = mongoose.Schema(
  {
    user_id: {
      type: String,
      required: false,
    },
    guest_id: {
      type: String,
      required: false,
    },
    full_name: {
      type: String,
      required: true,
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
          default: 1,
        },
        selected_image: {
          type: String,
          required: false,
        },
      },
    ],
    total_amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    payment_status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "completed", // Default to completed since no payment processing
    },
    shipping_address: {
      type: String,
      required: true,
    },
    order_email: {
      type: String,
      required: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email"],
    },
    phone_number: {
      type: String,
      required: true,
      match: [/^\+?\d{10,15}$/, "Please provide a valid phone number"],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);