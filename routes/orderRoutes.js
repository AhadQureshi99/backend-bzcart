const express = require("express");
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
} = require("../controllers/orderController");
const { paymentSuccess } = require("../controllers/paymentController");

const orderRouter = express.Router();

orderRouter.post("/create-order", createOrder);
orderRouter.get("/orders", getOrders);
orderRouter.get("/order/:id", getOrderById);
orderRouter.put("/order/:id", updateOrderStatus);
orderRouter.delete("/order/:id", deleteOrder);
orderRouter.post("/success", paymentSuccess);

module.exports = orderRouter;
