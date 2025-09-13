const express = require("express");
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
} = require("../controllers/orderController");

const orderRouter = express.Router();

orderRouter.post("/create-order", createOrder);
orderRouter.get("/orders", getOrders);
orderRouter.get("/order/:id", getOrderById);
orderRouter.put("/order/:id", updateOrderStatus);
orderRouter.delete("/order/:id", deleteOrder);

module.exports = orderRouter;