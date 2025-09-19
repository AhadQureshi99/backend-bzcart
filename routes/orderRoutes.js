const express = require("express");
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
} = require("../controllers/orderController");
const authHandler = require("../middlewares/authMiddleware"); // Add auth for protected routes

const orderRouter = express.Router();

// Public route for creating orders (guests can create orders)
orderRouter.post("/create-order", createOrder);

// Protected routes for authenticated users/admins
orderRouter.get("/orders",  getOrders);
orderRouter.get("/order/:id",  getOrderById);
orderRouter.put("/order/:id",  updateOrderStatus);
orderRouter.delete("/order/:id",  deleteOrder);

module.exports = orderRouter;
