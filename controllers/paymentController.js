const handler = require("express-async-handler");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const productModel = require("../models/productModel");
const orderModel = require("../models/orderModel");
const { v4: uuidv4 } = require("uuid");

const payment = handler(async (req, res) => {
  const { products, shipping_address, order_email, phone_number } = req.body;
  const user_id = req.user ? req.user._id : `guest_${uuidv4()}`;

  if (!products || !Array.isArray(products) || products.length === 0) {
    res.status(400);
    throw new Error("No products provided for checkout");
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

  try {
    const myItems = await Promise.all(
      products.map(async (item) => {
        const myProduct = await productModel.findOne({ _id: item.product_id });
        if (!myProduct) {
          throw new Error(`Product with ID ${item.product_id} not found`);
        }

        if (myProduct.product_stock < item.quantity) {
          throw new Error(
            `Product ${myProduct.product_name} has only ${myProduct.product_stock} units in stock`
          );
        }

        const selectedImage =
          item.selected_image &&
          myProduct.product_images.includes(item.selected_image)
            ? item.selected_image
            : myProduct.product_images[0] || "https://via.placeholder.com/150";

        return {
          price_data: {
            currency: "USD",
            product_data: {
              name: myProduct.product_name,
              images: [selectedImage],
            },
            unit_amount: Math.round(myProduct.product_discounted_price * 100),
          },
          quantity: item.quantity,
        };
      })
    );

    const total_amount = myItems.reduce(
      (sum, item) => sum + (item.price_data.unit_amount / 100) * item.quantity,
      0
    );

    const order = await orderModel.create({
      user_id,
      products: products.map((item) => ({
        product_id: item.product_id,
        quantity: item.quantity,
        selected_image: item.selected_image,
      })),
      total_amount,
      shipping_address,
      order_email,
      phone_number,
      status: "pending",
      payment_status: "pending",
    });

    await Promise.all(
      products.map(async (item) => {
        await productModel.findByIdAndUpdate(item.product_id, {
          $inc: { product_stock: -item.quantity },
        });
      })
    );

    const stripeSession = await stripe.checkout.sessions.create({
      line_items: myItems,
      mode: "payment",
      success_url: `http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: "http://localhost:5173/cancel",
      metadata: { orderId: order._id.toString(), user_id },
    });

    await orderModel.findByIdAndUpdate(order._id, {
      stripe_session_id: stripeSession.id,
    });

    res.status(200).json({ url: stripeSession.url });
  } catch (error) {
    console.error("Payment processing error:", error.message);
    res
      .status(400)
      .json({ message: error.message || "Failed to process payment" });
  }
});

const paymentSuccess = handler(async (req, res) => {
  const { session_id } = req.body;

  if (!session_id) {
    res.status(400);
    throw new Error("Session ID is required");
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status === "paid") {
      const order = await orderModel.findById(session.metadata.orderId);
      if (!order) {
        res.status(404);
        throw new Error("Order not found");
      }

      order.payment_status = "completed";
      order.status = "processing";
      await order.save();

      res.status(200).json({ message: "Payment verified and order updated" });
    } else {
      res.status(400);
      throw new Error("Payment not completed");
    }
  } catch (error) {
    console.error("Payment success error:", error.message);
    res
      .status(400)
      .json({ message: error.message || "Failed to verify payment" });
  }
});

module.exports = { payment, paymentSuccess };
