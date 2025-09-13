// controllers/webhookController.js
const handler = require("express-async-handler");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const orderModel = require("../models/orderModel");
const axios = require("axios");

const stripeWebhook = handler(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { orderId, user_id } = session.metadata;

    const order = await orderModel.findById(orderId);
    if (order) {
      order.payment_status = "completed";
      order.status = "processing";
      await order.save();
      console.log("Order updated:", order);

      // Clear the cart for the user or guest
      try {
        if (!user_id.startsWith("guest_")) {
          // For authenticated users, clear the cart via API
          await axios.post(
            "http://localhost:3003/api/products/clear-cart",
            {},
            {
              headers: {
                Authorization: `Bearer ${process.env.INTERNAL_API_TOKEN}`,
              }, // Use a secure internal token or user token
            }
          );
          console.log("Cart cleared for user:", user_id);
        } else {
          // For guest users, cart is managed differently (e.g., session-based, no action needed if client-side only)
          console.log("Guest cart cleared (client-side expected)");
        }
      } catch (err) {
        console.error("Error clearing cart:", err.message);
      }
    } else {
      console.error("Order not found for session:", session.id);
    }
  }

  res.status(200).json({ received: true });
});

module.exports = { stripeWebhook };
