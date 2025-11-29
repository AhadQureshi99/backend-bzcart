const mongoose = require("mongoose");

const activitySchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    user_display: { type: String, required: false },
    guest_id: { type: String, required: false },
    session_id: { type: String, required: false },
    event_type: { type: String, required: true }, // click | scroll | add_to_cart | page_view | session_start | session_end | custom
    url: { type: String, required: false },
    element: { type: String, required: false },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    duration_ms: { type: Number, required: false },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Activity", activitySchema);
