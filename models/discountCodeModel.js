const mongoose = require("mongoose");

const discountCodeSchema = mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      unique: true,
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: () => Date.now() + 7 * 24 * 60 * 60 * 1000, // Expires in 7 days
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
discountCodeSchema.index({ email: 1 });
discountCodeSchema.index({ code: 1 });
discountCodeSchema.index({ isUsed: 1 });
discountCodeSchema.index({ expiresAt: 1 });

// TTL index to automatically delete expired codes
discountCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports =
  mongoose.models.DiscountCode ||
  mongoose.model("DiscountCode", discountCodeSchema);
