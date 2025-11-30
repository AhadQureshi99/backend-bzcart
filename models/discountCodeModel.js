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
// Keep unique index on 'code' via field option and avoid re-declaring it here
discountCodeSchema.index({ email: 1 });
discountCodeSchema.index({ isUsed: 1 });

// TTL index to automatically delete expired codes. Do not define a second
// non-TTL index on expiresAt — TTL index is sufficient and avoids duplicate
// index warnings.
discountCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports =
  mongoose.models.DiscountCode ||
  mongoose.model("DiscountCode", discountCodeSchema);
