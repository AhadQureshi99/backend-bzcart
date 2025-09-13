const express = require("express");
const { stripeWebhook } = require("../controllers/webhookController");

const webhookRouter = express.Router();

webhookRouter.post(
  "/stripe",
  express.raw({ type: "application/json" }),
  stripeWebhook
);

module.exports = webhookRouter;
