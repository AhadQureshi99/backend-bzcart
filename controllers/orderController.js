const Order = require("../models/orderModel");
const asyncHandler = require("express-async-handler");

const createOrder = asyncHandler(async (req, res) => {
  const {
    products,
    total_amount,
    shipping_address,
    order_email,
    phone_number,
  } = req.body;
  const user_id = req.user ? req.user._id : `guest_${require("uuid").v4()}`;

  if (!products || !Array.isArray(products) || products.length === 0) {
    res.status(400);
    throw new Error("No products provided for order");
  }

  if (!shipping_address) {
    res.status(400);
    throw new Error("Shipping address is required");
  }

  if (!order_email) {
    res.status(400);
    throw new Error("Email address is required");
  }

  if (!phone_number) {
    res.status(400);
    throw new Error("Phone number is required");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(order_email)) {
    res.status(400);
    throw new Error("Invalid email address");
  }

  const phoneRegex = /^\+?\d{10,15}$/;
  if (!phoneRegex.test(phone_number)) {
    res.status(400);
    throw new Error("Invalid phone number");
  }

  const order = await Order.create({
    user_id,
    products,
    total_amount,
    shipping_address,
    order_email,
    phone_number,
  });

  res.status(201).json(order);
});

const getOrders = asyncHandler(async (req, res) => {
  try {
    const orders = await Order.find()
      .populate({
        path: "user_id",
        select: "username email",
        match: { _id: { $exists: true } },
      })
      .populate("products.product_id");
    res.status(200).json(orders);
  } catch (error) {
    console.error("Get orders error:", error.message, error.stack);
    res
      .status(500)
      .json({ message: error.message || "Failed to fetch orders" });
  }
});

const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate({
      path: "user_id",
      select: "username email",
      match: { _id: { $exists: true } },
    })
    .populate("products.product_id");
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }
  res.status(200).json(order);
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  if (
    !["pending", "processing", "shipped", "delivered", "cancelled"].includes(
      status
    )
  ) {
    res.status(400);
    throw new Error("Invalid status");
  }

  order.status = status;
  await order.save();
  res.status(200).json(order);
});

const deleteOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Order not found");
  }

  await Order.findByIdAndDelete(req.params.id);
  res.status(200).json({ message: "Order deleted successfully" });
});

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
};
