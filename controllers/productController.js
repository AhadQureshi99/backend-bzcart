const handler = require("express-async-handler");
const productModel = require("../models/productModel");
const cartModel = require("../models/cartModel");
const reviewModel = require("../models/reviewModel");
const Category = require("../models/categoryModel");
const User = require("../models/userModel");
const mongoose = require("mongoose");

const addToCart = handler(async (req, res) => {
  const { product_id, selected_image, guestId, selected_size } = req.body;
  const user_id = req.user?.id; // Use id to match generateToken

  console.log("addToCart - Called with:", {
    user_id,
    guestId,
    product_id,
    selected_image,
    selected_size,
  });

  // Validate inputs
  if (!product_id || !selected_image) {
    console.log("addToCart - Missing required fields:", {
      product_id,
      selected_image,
    });
    res.status(400);
    throw new Error("Product ID and selected image are required");
  }

  if (!user_id && !guestId) {
    console.log("addToCart - Neither user_id nor guestId provided");
    res.status(400);
    throw new Error("User or guest ID required");
  }

  if (user_id && !mongoose.Types.ObjectId.isValid(user_id)) {
    console.log("addToCart - Invalid user_id:", user_id);
    res.status(400);
    throw new Error("Invalid user ID");
  }

  if (guestId && (typeof guestId !== "string" || guestId.trim() === "")) {
    console.log("addToCart - Invalid guestId format:", guestId);
    res.status(400);
    throw new Error("Invalid guest ID format");
  }

  if (!mongoose.Types.ObjectId.isValid(product_id)) {
    console.log("addToCart - Invalid product_id:", product_id);
    res.status(400);
    throw new Error("Invalid product ID format");
  }

  try {
    const product = await productModel.findById(product_id);
    if (!product) {
      console.log("addToCart - Product not found:", product_id);
      res.status(404);
      throw new Error("Product not found");
    }

  if (product.sizes && product.sizes.length > 0 && !selected_size) {
    console.log("addToCart - Size required for product:", product_id);
    res.status(400);
    throw new Error("Please select a size for this product");
  }

  if (selected_size) {
    const sizeEntry = product.sizes.find((s) => s.size === selected_size);
    if (!sizeEntry || sizeEntry.stock <= 0) {
      console.log("addToCart - Invalid or out-of-stock size:", selected_size);
      res.status(400);
      throw new Error("Selected size is invalid or out of stock");
    }
  } else if (product.product_stock <= 0) {
    console.log("addToCart - Product out of stock:", product_id);
    res.status(400);
    throw new Error("Product is out of stock");
  }

  let cart;
  // Build query conditionally
  let query = guestId
    ? { guest_id: guestId, product_id, selected_image }
    : { user_id, product_id, selected_image };
  if (selected_size) {
    query.selected_size = selected_size;
  }

  cart = await cartModel.findOne(query);

  if (cart) {
    console.log(
      "addToCart - Incrementing quantity for existing cart item:",
      cart._id
    );
    cart.quantity += 1;
    await cart.save();
  } else {
    console.log("addToCart - Creating new cart item:", {
      user_id,
      guestId,
      product_id,
      selected_image,
      selected_size,
    });
    cart = await cartModel.create({
      user_id: user_id || undefined,
      guest_id: guestId || undefined,
      product_id,
      selected_image,
      selected_size: selected_size || undefined, // Only set if provided
      quantity: 1,
    });
  }

    const updatedCarts = await cartModel
      .find(user_id ? { user_id } : { guest_id: guestId })
      .populate("product_id");
    console.log("addToCart - Returning updated cart:", updatedCarts.length);
    res.status(200).json(updatedCarts);
  } catch (err) {
    console.error("addToCart - Error:", err.message);
    res.status(500);
    throw new Error("Failed to add to cart");
  }
});

const getMyCart = handler(async (req, res) => {
  const user_id = req.user?.id;
  const { guestId } = req.query;

  console.log("getMyCart - Called with:", { user_id, guestId });

  if (!user_id && !guestId) {
    console.log("getMyCart - Neither user_id nor guestId provided");
    res.status(400);
    throw new Error("User or guest ID required");
  }

  if (user_id && !mongoose.Types.ObjectId.isValid(user_id)) {
    console.log("getMyCart - Invalid user_id:", user_id);
    res.status(400);
    throw new Error("Invalid user ID");
  }

  if (guestId && (typeof guestId !== "string" || guestId.trim() === "")) {
    console.log("getMyCart - Invalid guestId format:", guestId);
    res.status(400);
    throw new Error("Invalid guest ID format");
  }

  try {
    const query = user_id ? { user_id } : { guest_id: guestId };
    const carts = await cartModel.find(query).populate("product_id");
    console.log("getMyCart - Found carts:", carts.length);
    res.status(200).json(carts);
  } catch (err) {
    console.error("getMyCart - Error:", err.message);
    res.status(500);
    throw new Error("Failed to fetch cart");
  }
});

const removeFromCart = handler(async (req, res) => {
  const { product_id, selected_image, guestId, selected_size } = req.body;
  const user_id = req.user?.id;

  console.log("removeFromCart - Called with:", {
    user_id,
    guestId,
    product_id,
    selected_image,
    selected_size,
  });

  if (!product_id || !selected_image) {
    console.log("removeFromCart - Missing required fields:", {
      product_id,
      selected_image,
    });
    res.status(400);
    throw new Error("Product ID and selected image are required");
  }

  if (!user_id && !guestId) {
    console.log("removeFromCart - Neither user_id nor guestId provided");
    res.status(400);
    throw new Error("User or guest ID required");
  }

  if (user_id && !mongoose.Types.ObjectId.isValid(user_id)) {
    console.log("removeFromCart - Invalid user_id:", user_id);
    res.status(400);
    throw new Error("Invalid user ID");
  }

  if (guestId && (typeof guestId !== "string" || guestId.trim() === "")) {
    console.log("removeFromCart - Invalid guestId format:", guestId);
    res.status(400);
    throw new Error("Invalid guest ID format");
  }

  if (!mongoose.Types.ObjectId.isValid(product_id)) {
    console.log("removeFromCart - Invalid product_id:", product_id);
    res.status(400);
    throw new Error("Invalid product ID format");
  }

  // Build query conditionally
  let query = user_id
    ? { user_id, product_id, selected_image }
    : { guest_id: guestId, product_id, selected_image };
  if (selected_size) {
    query.selected_size = selected_size;
  }

  let cart = await cartModel.findOne(query);

    if (!cart) {
      console.log("removeFromCart - Cart item not found:", query);
      res.status(404);
      throw new Error("Cart item not found");
    }

    if (cart.quantity > 1) {
      cart.quantity -= 1;
      await cart.save();
      console.log("removeFromCart - Decreased quantity:", cart._id);
    } else {
      await cartModel.deleteOne({ _id: cart._id });
      console.log("removeFromCart - Deleted cart item:", cart._id);
    }

    const updatedCarts = await cartModel
      .find(user_id ? { user_id } : { guest_id: guestId })
      .populate("product_id");
    console.log("removeFromCart - Returning updated cart:", updatedCarts.length);
    res.status(200).json(updatedCarts);
  } catch (err) {
    console.error("removeFromCart - Error:", err.message);
    res.status(500);
    throw new Error("Failed to remove from cart");
  }
});

const clearCart = handler(async (req, res) => {
  const user_id = req.user?.id;
  const { guestId } = req.query;

  console.log("clearCart - Called with:", { user_id, guestId });

  if (!user_id && !guestId) {
    console.log("clearCart - Neither user_id nor guestId provided");
    res.status(400);
    throw new Error("User or guest ID required");
  }

  if (user_id && !mongoose.Types.ObjectId.isValid(user_id)) {
    console.log("clearCart - Invalid user_id:", user_id);
    res.status(400);
    throw new Error("Invalid user ID");
  }

  if (guestId && (typeof guestId !== "string" || guestId.trim() === "")) {
    console.log("clearCart - Invalid guestId format:", guestId);
    res.status(400);
    throw new Error("Invalid guest ID format");
  }

  try {
    const query = user_id ? { user_id } : { guest_id: guestId };
    await cartModel.deleteMany(query);
    console.log("clearCart - Cleared cart for:", user_id || guestId);
    res.status(200).json([]);
  } catch (err) {
    console.error("clearCart - Error:", err.message);
    res.status(500);
    throw new Error("Failed to clear cart");
  }
});

const createProduct = handler(async (req, res) => {
  const {
    product_name,
    product_description,
    product_base_price,
    product_discounted_price,
    product_stock,
    sizes,
    warranty,
    product_images,
    category,
    subcategories,
    brand_name,
    product_code,
    rating,
    bg_color,
    shipping,
    payment,
    isNewArrival,
    isBestSeller,
  } = req.body;

  console.log("createProduct - Request body:", {
    product_name,
    product_base_price,
    product_discounted_price,
    category,
    brand_name,
    product_code,
    shipping,
    payment,
  });

  if (
    !product_name ||
    !product_base_price ||
    !product_discounted_price ||
    !product_images ||
    !category ||
    !brand_name ||
    !product_code ||
    !shipping ||
    !payment
  ) {
    console.log("createProduct - Missing required fields");
    res.status(400);
    throw new Error("Please provide all required fields");
  }

  try {
    const categoryExists = await Category.findById(category);
    if (!categoryExists || categoryExists.parent_category) {
      console.log("createProduct - Invalid category:", category);
      res.status(400);
      throw new Error("Invalid category ID or category is a subcategory");
    }

    if (subcategories && subcategories.length > 0) {
      const subcats = await Category.find({
        _id: { $in: subcategories },
        parent_category: category,
      });
      if (subcats.length !== subcategories.length) {
        console.log("createProduct - Invalid subcategories:", subcategories);
        res.status(400);
        throw new Error(
          "Invalid subcategories or they do not belong to the specified category"
        );
      }
    }

    const basePrice = Number(product_base_price);
    const discountedPrice = Number(product_discounted_price);
    const shippingCost = Number(shipping);
    const stock = Number(product_stock);

    if (
      isNaN(basePrice) ||
      isNaN(discountedPrice) ||
      basePrice <= 0 ||
      discountedPrice <= 0
    ) {
      console.log("createProduct - Invalid prices:", { basePrice, discountedPrice });
      res.status(400);
      throw new Error("Prices must be valid positive numbers");
    }

    if (discountedPrice > basePrice) {
      console.log("createProduct - Discounted price higher than base price");
      res.status(400);
      throw new Error("Discounted price cannot be higher than base price");
    }

    if (isNaN(shippingCost) || shippingCost < 0) {
      console.log("createProduct - Invalid shipping cost:", shippingCost);
      res.status(400);
      throw new Error("Shipping cost must be a non-negative number");
    }

    if (isNaN(stock) || stock < 0) {
      console.log("createProduct - Invalid stock:", stock);
      res.status(400);
      throw new Error("Stock must be a non-negative number");
    }

    if (sizes && Array.isArray(sizes)) {
      const validSizes = ["S", "M", "L", "XL"];
      for (const size of sizes) {
        if (!validSizes.includes(size.size) || isNaN(size.stock) || size.stock < 0) {
          console.log("createProduct - Invalid size or stock:", size);
          res.status(400);
          throw new Error("Invalid size or stock value. Sizes must be S, M, L, or XL.");
        }
      }
    }

    if (!Array.isArray(payment) || payment.length === 0) {
      console.log("createProduct - Invalid payment methods:", payment);
      res.status(400);
      throw new Error("At least one payment method is required");
    }

    if (bg_color && !/^#[0-9A-F]{6}$/i.test(bg_color)) {
      console.log("createProduct - Invalid bg_color:", bg_color);
      res.status(400);
      throw new Error(
        "Invalid background color format. Use a hex code (e.g., #FFFFFF)"
      );
    }

    const product = await productModel.create({
      product_name,
      product_description: product_description || "",
      product_base_price: basePrice,
      product_discounted_price: discountedPrice,
      product_stock: stock,
      sizes: sizes || [],
      warranty: warranty || "",
      product_images: Array.isArray(product_images) ? product_images : [],
      category,
      subcategories: subcategories || [],
      brand_name,
      product_code,
      rating: Number(rating) || 4,
      reviews: [],
      bg_color: bg_color || "#FFFFFF",
      shipping: shippingCost,
      payment: payment || ["Cash on Delivery"],
      isNewArrival: Boolean(isNewArrival),
      isBestSeller: Boolean(isBestSeller),
    });

    const populatedProduct = await productModel
      .findById(product._id)
      .populate("category")
      .populate("subcategories");
    console.log("createProduct - Created product:", product._id);
    res.status(201).json(populatedProduct);
  } catch (err) {
    console.error("createProduct - Error:", err.message);
    res.status(500);
    throw new Error("Failed to create product");
  }
});

const getProducts = handler(async (req, res) => {
  try {
    const products = await productModel
      .find()
      .populate("category")
      .populate("subcategories")
      .populate("reviews");
    console.log("getProducts - Found products:", products.length);
    res.status(200).json(products);
  } catch (err) {
    console.error("getProducts - Error:", err.message);
    res.status(500);
    throw new Error("Failed to fetch products");
  }
});

const getProductById = handler(async (req, res) => {
  console.log("getProductById - Request params:", req.params);

  try {
    const product = await productModel
      .findById(req.params.id)
      .populate("category")
      .populate("subcategories")
      .populate("reviews");
    if (!product) {
      console.log("getProductById - Product not found:", req.params.id);
      res.status(404);
      throw new Error("Product not found");
    }
    console.log("getProductById - Found product:", product._id);
    res.status(200).json(product);
  } catch (err) {
    console.error("getProductById - Error:", err.message);
    res.status(err.status || 500);
    throw new Error(err.message || "Failed to fetch product");
  }
});

const getProductsByCategory = handler(async (req, res) => {
  const categoryId = req.params.categoryId;
  console.log("getProductsByCategory - Category ID:", categoryId);

  try {
    const products = await productModel
      .find({
        $or: [{ category: categoryId }, { subcategories: categoryId }],
      })
      .populate("category")
      .populate("subcategories")
      .populate("reviews");
    if (!products || products.length === 0) {
      console.log("getProductsByCategory - No products found for category:", categoryId);
      res.status(404);
      throw new Error("No products found in this category or subcategory");
    }
    console.log("getProductsByCategory - Found products:", products.length);
    res.status(200).json(products);
  } catch (err) {
    console.error("getProductsByCategory - Error:", err.message);
    res.status(err.status || 500);
    throw new Error(err.message || "Failed to fetch products");
  }
});

const updateProduct = handler(async (req, res) => {
  console.log("updateProduct - Request params:", req.params);
  console.log("updateProduct - Request body:", req.body);

  try {
    const product = await productModel.findById(req.params.id);
    if (!product) {
      console.log("updateProduct - Product not found:", req.params.id);
      res.status(404);
      throw new Error("Product not found");
    }

    const {
      product_name,
      product_description,
      product_base_price,
      product_discounted_price,
      product_stock,
      sizes,
      warranty,
      product_images,
      category,
      subcategories,
      brand_name,
      product_code,
      rating,
      bg_color,
      shipping,
      payment,
      isNewArrival,
      isBestSeller,
    } = req.body;

    if (category) {
      const categoryExists = await Category.findById(category);
      if (!categoryExists || categoryExists.parent_category) {
        console.log("updateProduct - Invalid category:", category);
        res.status(400);
        throw new Error("Invalid category ID or category is a subcategory");
      }
    }

    if (subcategories && subcategories.length > 0) {
      const subcats = await Category.find({
        _id: { $in: subcategories },
        parent_category: category || product.category,
      });
      if (subcats.length !== subcategories.length) {
        console.log("updateProduct - Invalid subcategories:", subcategories);
        res.status(400);
        throw new Error(
          "Invalid subcategories or they do not belong to the specified category"
        );
      }
    }

    let basePrice =
      product_base_price !== undefined
        ? Number(product_base_price)
        : product.product_base_price;
    let discountedPrice =
      product_discounted_price !== undefined
        ? Number(product_discounted_price)
        : product.product_discounted_price;
    let shippingCost =
      shipping !== undefined ? Number(shipping) : product.shipping;
    let stock =
      product_stock !== undefined ? Number(product_stock) : product.product_stock;

    if (
      product_base_price !== undefined &&
      (isNaN(basePrice) || basePrice <= 0)
    ) {
      console.log("updateProduct - Invalid base price:", basePrice);
      res.status(400);
      throw new Error("Base price must be a positive number");
    }

    if (
      product_discounted_price !== undefined &&
      (isNaN(discountedPrice) || discountedPrice <= 0)
    ) {
      console.log("updateProduct - Invalid discounted price:", discountedPrice);
      res.status(400);
      throw new Error("Discounted price must be a positive number");
    }

    if (
      product_base_price !== undefined &&
      product_discounted_price !== undefined &&
      discountedPrice > basePrice
    ) {
      console.log("updateProduct - Discounted price higher than base price");
      res.status(400);
      throw new Error("Discounted price cannot be higher than base price");
    }

    if (shipping !== undefined && (isNaN(shippingCost) || shippingCost < 0)) {
      console.log("updateProduct - Invalid shipping cost:", shippingCost);
      res.status(400);
      throw new Error("Shipping cost must be a non-negative number");
    }

    if (product_stock !== undefined && (isNaN(stock) || stock < 0)) {
      console.log("updateProduct - Invalid stock:", stock);
      res.status(400);
      throw new Error("Stock must be a non-negative number");
    }

    if (sizes && Array.isArray(sizes)) {
      const validSizes = ["S", "M", "L", "XL"];
      for (const size of sizes) {
        if (!validSizes.includes(size.size) || isNaN(size.stock) || size.stock < 0) {
          console.log("updateProduct - Invalid size or stock:", size);
          res.status(400);
          throw new Error("Invalid size or stock value. Sizes must be S, M, L, or XL.");
        }
      }
    }

    if (
      payment !== undefined &&
      (!Array.isArray(payment) || payment.length === 0)
    ) {
      console.log("updateProduct - Invalid payment methods:", payment);
      res.status(400);
      throw new Error("At least one payment method is required");
    }

    if (bg_color && !/^#[0-9A-F]{6}$/i.test(bg_color)) {
      console.log("updateProduct - Invalid bg_color:", bg_color);
      res.status(400);
      throw new Error(
        "Invalid background color format. Use a hex code (e.g., #FFFFFF)"
      );
    }

    const updatedProduct = await productModel
      .findByIdAndUpdate(
        req.params.id,
        {
          product_name: product_name || product.product_name,
          product_description: product_description || product.product_description,
          product_base_price: basePrice,
          product_discounted_price: discountedPrice,
          product_stock: stock,
          sizes: sizes || product.sizes,
          warranty: warranty || product.warranty,
          product_images: product_images || product.product_images,
          category: category || product.category,
          subcategories: subcategories || product.subcategories,
          brand_name: brand_name || product.brand_name,
          product_code: product_code || product.product_code,
          rating: Number(rating) || product.rating,
          bg_color: bg_color || product.bg_color,
          shipping: shippingCost,
          payment: payment || product.payment,
          isNewArrival:
            isNewArrival !== undefined
              ? Boolean(isNewArrival)
              : product.isNewArrival,
          isBestSeller:
            isBestSeller !== undefined
              ? Boolean(isBestSeller)
              : product.isBestSeller,
        },
        { new: true }
      )
      .populate("category")
      .populate("subcategories")
      .populate("reviews");

    console.log("updateProduct - Updated product:", updatedProduct._id);
    res.status(200).json(updatedProduct);
  } catch (err) {
    console.error("updateProduct - Error:", err.message);
    res.status(err.status || 500);
    throw new Error(err.message || "Failed to update product");
  }
});

const deleteProduct = handler(async (req, res) => {
  console.log("deleteProduct - Request params:", req.params);

  try {
    const product = await productModel.findById(req.params.id);
    if (!product) {
      console.log("deleteProduct - Product not found:", req.params.id);
      res.status(404);
      throw new Error("Product not found");
    }

    await reviewModel.deleteMany({ product_id: req.params.id });
    await cartModel.deleteMany({ product_id: req.params.id });
    await productModel.findByIdAndDelete(req.params.id);

    console.log("deleteProduct - Product deleted successfully:", req.params.id);
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("deleteProduct - Error:", err.message);
    res.status(err.status || 500);
    throw new Error(err.message || "Failed to delete product");
  }
});

const submitReview = handler(async (req, res) => {
  console.log("submitReview - Request body:", req.body);

  const { user_id, rating, comment } = req.body;
  const product_id = req.params.productId;

  if (!user_id || !rating || !comment) {
    console.log("submitReview - Missing required fields:", {
      user_id,
      rating,
      comment,
    });
    res.status(400);
    throw new Error("User ID, rating, and comment are required");
  }

  if (
    !mongoose.Types.ObjectId.isValid(user_id) ||
    !mongoose.Types.ObjectId.isValid(product_id)
  ) {
    console.log("submitReview - Invalid ID format:", { user_id, product_id });
    res.status(400);
    throw new Error("Invalid user or product ID format");
  }

  try {
    const user = await User.findById(user_id);
    if (!user) {
      console.log("submitReview - User not found:", user_id);
      res.status(404);
      throw new Error("User not found");
    }

    const product = await productModel.findById(product_id);
    if (!product) {
      console.log("submitReview - Product not found:", product_id);
      res.status(404);
      throw new Error("Product not found");
    }

    const existingReview = await reviewModel.findOne({ user_id, product_id });
    if (existingReview) {
      console.log("submitReview - User already reviewed product:", user_id);
      res.status(400);
      throw new Error("You have already reviewed this product");
    }

    const review = await reviewModel.create({
      user_id,
      product_id,
      rating,
      comment,
    });

    product.reviews.push(review._id);
    const reviews = await reviewModel.find({ product_id });
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    product.rating = reviews.length > 0 ? totalRating / reviews.length : 0;
    await product.save();

    const populatedReview = await reviewModel
      .findById(review._id)
      .populate("user_id", "username");
    console.log("submitReview - Created review:", populatedReview._id);
    res.status(201).json(populatedReview);
  } catch (err) {
    console.error("submitReview - Error:", err.message);
    res.status(err.status || 500);
    throw new Error(err.message || "Failed to submit review");
  }
});

const getReviews = handler(async (req, res) => {
  const product_id = req.params.productId;
  console.log(`getReviews - Fetching reviews for product_id: ${product_id}`);

  if (!mongoose.Types.ObjectId.isValid(product_id)) {
    console.log("getReviews - Invalid product_id:", product_id);
    res.status(400);
    throw new Error("Invalid product ID format");
  }

  try {
    const product = await productModel.findById(product_id);
    if (!product) {
      console.log(`getReviews - Product not found: ${product_id}`);
      res.status(404);
      throw new Error("Product not found");
    }

    const reviews = await reviewModel
      .find({ product_id })
      .populate("user_id", "username");
    console.log(`getReviews - Found ${reviews.length} reviews for product_id: ${product_id}`);
    res.status(200).json(reviews);
  } catch (err) {
    console.error("getReviews - Error:", err.message);
    res.status(err.status || 500);
    throw new Error(err.message || "Failed to fetch reviews");
  }
});

module.exports = {
  createProduct,
  getProducts,
  getProductById,
  getProductsByCategory,
  updateProduct,
  deleteProduct,
  addToCart,
  getMyCart,
  removeFromCart,
  clearCart,
  submitReview,
  getReviews,
};