// orderController.js
const Order = require("../models/orderModel");
const Product = require("../models/productModel");
const discountCodeModel = require("../models/discountCodeModel");
const asyncHandler = require("express-async-handler");
const Cart = require("../models/cartModel");
const mongoose = require("mongoose");
const Activity = require("../models/activityModel");

const createOrder = asyncHandler(async (req, res) => {
  console.log("createOrder - Request body:", req.body);

  const {
    products,
    total_amount: subtotal_from_frontend,
    shipping_address,
    order_email,
    phone_number,
    full_name,
    guestId,
    discount_code,
  } = req.body;
  // For authenticated users, use req.user.id (to match token)
  const isAuthenticated = !!req.user;
  const userId = isAuthenticated ? req.user.id : undefined;
  console.log("createOrder - Auth status:", {
    isAuthenticated,
    userId,
    guestId,
  });

  // Log user info for debugging
  if (isAuthenticated) {
    console.log("createOrder - Authenticated user info:", {
      id: req.user.id,
      username: req.user.username,
    });
  }

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

  // Validate products and stock, and compute shipping total
  let shipping_total = 0;
  let validatedProducts = [];
  for (const item of products) {
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
        console.log(
          "createOrder - Missing selected_size for product with sizes:",
          item.product_id
        );
        res.status(400);
        throw new Error(
          `Product ${product.product_name} requires a size selection`
        );
      }
      const sizeEntry = product.sizes.find(
        (s) => s.size === item.selected_size
      );
      if (!sizeEntry || sizeEntry.stock < item.quantity) {
        console.log("createOrder - Insufficient stock for size:", {
          product: product.product_name,
          size: item.selected_size,
          stock: sizeEntry ? sizeEntry.stock : 0,
          requested: item.quantity,
        });
        res.status(400);
        throw new Error(
          `Product ${product.product_name} size ${
            item.selected_size
          } has only ${sizeEntry ? sizeEntry.stock : 0} units in stock`
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
    shipping_total += product.shipping * item.quantity;
    validatedProducts.push({ ...item, product });
  }

  // Validate discount code
  let original_subtotal = subtotal_from_frontend;
  let original_total = original_subtotal + shipping_total;
  let final_subtotal = original_subtotal;
  let final_total = original_total;
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
    final_subtotal = Math.round(original_subtotal * 0.9 * 100) / 100;
    final_total = final_subtotal + shipping_total;
    original_total = original_subtotal + shipping_total;
    discount_applied = true;
    discount_code_used = discount_code.trim().toUpperCase();
    discount.isUsed = true;
    await discount.save();
  }

  // Create order
  console.log("createOrder - Creating order with:", { userId, guestId });
  const order = await Order.create({
    user_id: userId, // Use userId (from req.user.id) for authenticated users
    guest_id: !userId ? guestId : undefined, // Only use guestId for non-authenticated users
    full_name,
    products: products.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      selected_image: item.selected_image,
      selected_size: item.selected_size || null,
    })),
    total_amount: final_total,
    original_amount: original_total,
    shipping_amount: shipping_total,
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
  const cartQuery = isAuthenticated
    ? { user_id: userId }
    : { guest_id: guestId };
  await Cart.deleteMany(cartQuery);

  console.log("createOrder - Order created successfully:", order._id);
  // Log server-side analytics event for order creation
  try {
    await Activity.create({
      user_id:
        userId && mongoose.Types.ObjectId.isValid(userId) ? userId : null,
      user_display: req.user?.username || full_name || order_email || null,
      guest_id: !userId ? guestId : null,
      event_type: "order_placed",
      url: req.headers.referer || null,
      data: {
        order_id: order._id,
        products: products.map((p) => {
          // find canonical product object from validatedProducts when available
          const validated = validatedProducts.find(
            (vp) => String(vp.product._id) === String(p.product_id)
          );
          const productObj = validated?.product || null;
          let finalImage = p.selected_image;
          if (productObj && Array.isArray(productObj.product_images)) {
            if (productObj.product_images.includes(p.selected_image)) {
              finalImage = p.selected_image;
            } else if (productObj.product_images.length) {
              finalImage = productObj.product_images[0];
            }
          }
          return {
            product_id: p.product_id,
            product_name: productObj?.product_name || null,
            selected_image: finalImage || null,
            quantity: p.quantity,
          };
        }),
        total_amount: final_total,
      },
    });
  } catch (err) {
    console.warn("createOrder - analytics log failed:", err?.message || err);
  }
  res.status(201).json(order);
});

const getMyOrders = asyncHandler(async (req, res) => {
  // Debug logs: print auth header, req.user, req.params, and req.query
  console.log("getMyOrders - Authorization header:", req.headers.authorization);
  console.log("getMyOrders - req.user:", req.user);
  console.log("getMyOrders - req.params:", req.params);
  console.log("getMyOrders - req.query:", req.query);

  let query = {};
  // For authenticated users, use their ID (using .id to match token generation)
  if (req.user && req.user.id) {
    query.user_id = req.user.id;
    console.log("getMyOrders - Using authenticated user ID:", req.user.id);
  }
  // If guestId provided in query params, use it for guest orders
  else if (req.query.guestId) {
    query.guest_id = req.query.guestId;
    console.log("getMyOrders - Using guestId from query:", req.query.guestId);
  } else {
    console.log("getMyOrders - No valid identifier found");
    return res.status(200).json([]);
  }
  console.log("getMyOrders - MongoDB query:", query);

  try {
    const orders = await Order.find(query)
      .populate({
        path: "user_id",
        select: "username email",
        match: { _id: { $exists: true } },
      })
      .populate("products.product_id")
      .sort({ createdAt: -1 });

    console.log("getMyOrders - Query results:", {
      count: orders.length,
      orderIds: orders.map((o) => o._id),
      queryUsed: query,
    });

    res.status(200).json(orders || []);
  } catch (err) {
    console.error("getMyOrders error:", err.message, err.stack);
    res
      .status(500)
      .json({ message: err.message || "Failed to fetch user orders" });
  }
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
  getMyOrders,
  getOrders,
  getOrderById,
  updateOrderStatus,
  deleteOrder,
};
