const express = require("express");
const { payment } = require("../controllers/paymentController");

const paymentRoutes = express.Router();

paymentRoutes.post("/checkout", payment);

module.exports = paymentRoutes;
