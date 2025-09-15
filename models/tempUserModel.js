const mongoose = require("mongoose");

const tempUserSchema = mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    otp: {
      type: Number,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 600, // Automatically delete after 10 minutes (600 seconds)
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.models.TempUser || mongoose.model("TempUser", tempUserSchema);
