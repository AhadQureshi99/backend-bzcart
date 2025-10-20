const express = require("express");
const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
  getMyOrders,
} = require("../controllers/orderController");
const authHandler = require("../middlewares/authMiddleware"); // Add auth for protected routes

const orderRouter = express.Router();

// Routes that support both authenticated users and guests
// authHandler allows requests without tokens but sets req.user when token is present
orderRouter.post("/create-order", authHandler, createOrder);
orderRouter.get("/my-orders", authHandler, getMyOrders); // Removed userId param since we get it from auth token

// Protected routes for authenticated users/admins
orderRouter.get("/orders", getOrders);
orderRouter.get("/order/:id", getOrderById);
orderRouter.put("/order/:id", updateOrderStatus);
orderRouter.delete("/order/:id", deleteOrder);

module.exports = orderRouter;
