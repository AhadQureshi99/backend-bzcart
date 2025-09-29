const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const discountCodeModel = require("../models/discountCodeModel");
const asyncHandler = require("express-async-handler");
const Cart = require("../models/cartModel");

const createOrder = asyncHandler(async (req, res) => {
  console.log("createOrder - Request body:", req.body);

  const {
    products,
    total_amount,
    shipping_address,
    order_email,
    phone_number,
    full_name,
    guestId,
    discount_code,
  } = req.body;
  const user_id = req.user ? req.user._id : guestId;

  // Validate required fields
  if (!products || !Array.isArray(products) || products.length === 0) {
    console.log("createOrder - Missing products array");
    res.status(400);
    throw new Error("No products provided for order");
  }
  if (!shipping_address) {
    console.log("createOrder - Missing shipping_address");
    res.status(400);
    throw new Error("Shipping address is required");
  }
  if (!order_email) {
    console.log("createOrder - Missing order_email");
    res.status(400);
    throw new Error("Email address is required");
  }
  if (!phone_number) {
    console.log("createOrder - Missing phone_number");
    res.status(400);
    throw new Error("Phone number is required");
  }
  if (!full_name) {
    console.log("createOrder - Missing full_name");
    res.status(400);
    throw new Error("Full name is required");
  }

  // Validate email and phone formats
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(order_email)) {
    console.log("createOrder - Invalid email format:", order_email);
    res.status(400);
    throw new Error("Invalid email address");
  }
  const phoneRegex = /^\+?\d{10,15}$/;
  if (!phoneRegex.test(phone_number)) {
    console.log("createOrder - Invalid phone format:", phone_number);
    res.status(400);
    throw new Error("Invalid phone number");
  }

  // Validate discount code
  let original_amount = total_amount;
  let final_amount = total_amount;
  let discount_applied = false;
  let discount_code_used = null;
  if (discount_code) {
    const discount = await discountCodeModel.findOne({
      code: discount_code.trim().toUpperCase(),
      email: order_email,
    });
    if (!discount) {
      console.log("createOrder - Invalid discount code:", discount_code);
      res.status(400);
      throw new Error("Invalid or expired discount code");
    }
    if (discount.isUsed) {
      console.log("createOrder - Discount code already used:", discount_code);
      res.status(400);
      throw new Error("Discount code has already been used");
    }
    if (discount.expiresAt < Date.now()) {
      console.log("createOrder - Discount code expired:", discount_code);
      res.status(400);
      throw new Error("Discount code has expired");
    }
    final_amount = Math.round(total_amount * 0.9 * 100) / 100;
    original_amount = total_amount;
    discount_applied = true;
    discount_code_used = discount_code.trim().toUpperCase();
    discount.isUsed = true;
    await discount.save();
  }

  // Validate products and stock
  await Promise.all(
    products.map(async (item) => {
      if (!item.product_id || !item.quantity || !item.selected_image) {
        console.log("createOrder - Invalid product data:", item);
        res.status(400);
        throw new Error(
          "Each product must have product_id, quantity, and selected_image"
        );
      }
      const product = await Product.findById(item.product_id);
      if (!product) {
        console.log("createOrder - Product not found:", item.product_id);
        res.status(404);
        throw new Error(`Product with ID ${item.product_id} not found`);
      }
      if (product.sizes && product.sizes.length > 0) {
        if (!item.selected_size) {
          console.log("createOrder - Missing selected_size for product with sizes:", item.product_id);
          res.status(400);
          throw new Error(`Product ${product.product_name} requires a size selection`);
        }
        const sizeEntry = product.sizes.find((s) => s.size === item.selected_size);
        if (!sizeEntry || sizeEntry.stock < item.quantity) {
          console.log("createOrder - Insufficient stock for size:", {
            product: product.product_name,
            size: item.selected_size,
            stock: sizeEntry ? sizeEntry.stock : 0,
            requested: item.quantity,
          });
          res.status(400);
          throw new Error(
            `Product ${product.product_name} size ${item.selected_size} has only ${sizeEntry ? sizeEntry.stock : 0} units in stock`
          );
        }
      } else if (product.product_stock < item.quantity) {
        console.log("createOrder - Insufficient stock:", {
          product: product.product_name,
          stock: product.product_stock,
          requested: item.quantity,
        });
        res.status(400);
        throw new Error(
          `Product ${product.product_name} has only ${product.product_stock} units in stock`
        );
      }
    })
  );

  // Create order
  const order = await Order.create({
    user_id: user_id && !user_id.startsWith("guest_") ? user_id : undefined,
    guest_id: guestId || undefined,
    full_name,
    products: products.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      selected_image: item.selected_image,
      selected_size: item.selected_size || null, // Ensure selected_size is included
    })),
    total_amount: final_amount,
    original_amount,
    discount_applied,
    discount_code: discount_code_used,
    shipping_address,
    order_email,
    phone_number,
    status: "pending",
    payment_status: "completed",
  });

  // Update stock
  await Promise.all(
    products.map(async (item) => {
      const update = item.selected_size
        ? { $inc: { "sizes.$[elem].stock": -item.quantity } }
        : { $inc: { product_stock: -item.quantity } };
      const options = item.selected_size
        ? { arrayFilters: [{ "elem.size": item.selected_size }] }
        : {};
      await Product.findByIdAndUpdate(item.product_id, update, options);
    })
  );

  // Clear cart
  const query = user_id && !user_id.startsWith("guest_") ? { user_id } : { guest_id: guestId };
  await Cart.deleteMany(query);

  console.log("createOrder - Order created successfully:", order._id);
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
      .populate("products.product_id")
      .sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    console.error("Get orders error:", error.message, error.stack);
    res.status(500).json({ message: error.message || "Failed to fetch orders" });
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

  await Promise.all(
    order.products.map(async (item) => {
      const update = item.selected_size
        ? { $inc: { "sizes.$[elem].stock": item.quantity } }
        : { $inc: { product_stock: item.quantity } };
      const options = item.selected_size
        ? { arrayFilters: [{ "elem.size": item.selected_size }] }
        : {};
      await Product.findByIdAndUpdate(item.product_id, update, options);
    })
  );

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