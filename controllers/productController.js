const handler = require("express-async-handler");
const productModel = require("../models/productModel");
const cartModel = require("../models/cartModel");
const Activity = require("../models/activityModel");
const reviewModel = require("../models/reviewModel");
const Category = require("../models/categoryModel");
const User = require("../models/userModel");
const mongoose = require("mongoose");
const { getClientIp } = require("../utils/getClientIp");
const wishlistModel = require("../models/wishlistModel");

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

    let canAddToCart = false;
    if (product.sizes && product.sizes.length > 0) {
      if (!selected_size) {
        console.log(
          "addToCart - Missing selected_size for sized product:",
          product_id
        );
        res.status(400);
        throw new Error("Size is required for this product");
      }
      const size = product.sizes.find((s) => s.size === selected_size);
      if (!size) {
        console.log("addToCart - Invalid size:", selected_size);
        res.status(400);
        throw new Error("Invalid size selected");
      }
      if (size.stock <= 0) {
        console.log("addToCart - Size out of stock:", selected_size);
        res.status(400);
        throw new Error(`Size ${selected_size} is out of stock`);
      }
      canAddToCart = true;
    } else {
      if (product.product_stock <= 0) {
        console.log("addToCart - Product out of stock:", product_id);
        res.status(400);
        throw new Error("Product is out of stock");
      }
      canAddToCart = true;
    }

    if (!canAddToCart) {
      console.log("addToCart - Cannot add to cart due to stock issues");
      res.status(400);
      throw new Error("Cannot add to cart");
    }

    const query = user_id
      ? {
          user_id,
          product_id,
          selected_image,
          selected_size: selected_size || null,
        }
      : {
          guest_id: guestId,
          product_id,
          selected_image,
          selected_size: selected_size || null,
        };

    console.log("addToCart - Query for existing cart item:", query);

    let cart = await cartModel.findOne(query);
    if (cart) {
      const newQuantity = cart.quantity + 1;
      if (product.sizes && product.sizes.length > 0) {
        const size = product.sizes.find((s) => s.size === selected_size);
        if (newQuantity > size.stock) {
          console.log("addToCart - Exceeds stock for size:", selected_size);
          res.status(400);
          throw new Error(
            `Cannot add more: Size ${selected_size} stock limit reached`
          );
        }
      } else {
        if (newQuantity > product.product_stock) {
          console.log("addToCart - Exceeds product stock:", product_id);
          res.status(400);
          throw new Error("Cannot add more: Product stock limit reached");
        }
      }
      cart.quantity = newQuantity;
      await cart.save();
      console.log("addToCart - Updated cart item:", cart._id);
    } else {
      cart = await cartModel.create({
        user_id: user_id || null,
        guest_id: user_id ? null : guestId,
        product_id,
        selected_image,
        selected_size: selected_size || null,
        quantity: 1,
      });
      console.log("addToCart - Created new cart item:", cart._id);
    }

    let updatedCarts = await cartModel
      .find(user_id ? { user_id } : { guest_id: guestId })
      .populate("product_id");
    // Normalize selected_image to ensure it refers to the product's images
    updatedCarts = updatedCarts.map((it) => {
      const prod = it.product_id || {};
      let selected = it.selected_image || null;
      if (
        !selected ||
        !Array.isArray(prod.product_images) ||
        !prod.product_images.includes(selected)
      ) {
        // prefer product canonical image when mismatch
        selected =
          Array.isArray(prod.product_images) && prod.product_images.length
            ? prod.product_images[0]
            : selected;
      }
      // return a shallow copy with normalized selected_image so UI sees correct images
      return Object.assign({}, it.toObject ? it.toObject() : it, {
        selected_image: selected,
        product_id: prod,
      });
    });
    // compute cart totals and include product info in server-side analytics
    const totalItems = updatedCarts.reduce(
      (t, it) => t + (it.quantity || 0),
      0
    );
    try {
      // Canonical product fields from DB (use these for analytics to avoid stale/mismatched client payloads)
      const productName = product?.product_name || null;
      const productPrice =
        product?.product_discounted_price ||
        product?.product_base_price ||
        null;

      // Choose a validated selected image: prefer the one passed in request if it's present in product images; else use product's first image
      // Choose selected image only when it belongs to the product (preferred).
      // Otherwise, fall back to the product's canonical first image; if the
      // product has no registered images, accept the client's selected_image.
      let finalSelectedImage = null;
      if (
        selected_image &&
        Array.isArray(product.product_images) &&
        product.product_images.includes(selected_image)
      ) {
        finalSelectedImage = selected_image;
      } else if (
        Array.isArray(product.product_images) &&
        product.product_images.length > 0
      ) {
        finalSelectedImage = product.product_images[0];
      } else if (selected_image) {
        finalSelectedImage = selected_image;
      }

      // Merge server meta and optional client-provided meta (ua/device_model) if present
      const mergedMeta = Object.assign(
        {
          server_logged: true,
          ip: getClientIp(req),
        },
        req.body.meta || {}
      );

      // Attach parsed UA info (device model / os) when available
      try {
        const { parseUA } = require("../utils/uaParser");
        const uaHeader = req.headers["user-agent"] || null;
        if (uaHeader) {
          const parsed = parseUA(uaHeader);
          mergedMeta.ua = mergedMeta.ua || parsed.ua || uaHeader;
          if (parsed.os_name)
            mergedMeta.os_name = mergedMeta.os_name || parsed.os_name;
          if (parsed.os_version)
            mergedMeta.os_version = mergedMeta.os_version || parsed.os_version;
          if (parsed.device_model)
            mergedMeta.device_model =
              mergedMeta.device_model || parsed.device_model;
          if (parsed.device_type)
            mergedMeta.device_type =
              mergedMeta.device_type || parsed.device_type;
        }
      } catch (e) {}

      // full cart snapshot for historical accuracy (server-canonical)
      const cartSnapshot = updatedCarts.map((it) => ({
        _id: it._id,
        product_id: it.product_id?._id || it.product_id,
        product_name: it.product_id?.product_name || null,
        selected_image:
          it.selected_image || it.product_id?.product_images?.[0] || null,
        selected_size: it.selected_size || null,
        quantity: it.quantity || 0,
        price:
          it.product_id?.product_discounted_price ||
          it.product_id?.product_base_price ||
          null,
      }));

      const activityDoc = await Activity.create({
        user_id:
          user_id && mongoose.Types.ObjectId.isValid(user_id) ? user_id : null,
        user_display: req.user?.username || req.user?.email || null,
        guest_id: guestId || null,
        event_type: "add_to_cart",
        url: req.headers.referer || req.body.url || null,
        data: {
          product_id,
          product_name: productName,
          price: productPrice,
          selected_size: selected_size || null,
          selected_image: finalSelectedImage,
          quantity: 1,
          cart_item_count: totalItems,
          // include product snapshot for historical accuracy
          product_snapshot: {
            product_name: productName,
            product_images: Array.isArray(product.product_images)
              ? product.product_images
              : [],
          },
          cart_snapshot: cartSnapshot,
        },
        meta: mergedMeta,
      });
      // realtime socket emission removed — analytics consumers should poll
      // Enrich geolocation for server-side logged events (best-effort, short timeout)
      try {
        const ip = getClientIp(req);
        if (ip) {
          const url = `https://ipapi.co/${ip}/json/`;
          const controller = new AbortController();
          const tmr = setTimeout(() => controller.abort(), 1000);
          try {
            const r = await fetch(url, { signal: controller.signal });
            clearTimeout(tmr);
            if (r && r.ok) {
              const info = await r.json();
              const loc = {
                ip,
                city: info.city || null,
                region: info.region || null,
                country: info.country_name || info.country || null,
                latitude: info.latitude || info.lat || null,
                longitude: info.longitude || info.lon || null,
                org: info.org || null,
              };
              await Activity.findByIdAndUpdate(
                activityDoc._id,
                { $set: { "meta.location": loc } },
                { new: true }
              );
            }
          } catch (e) {
            /* ignore fetch/timeout */
          }
        }
      } catch (e) {
        /* ignore */
      }
    } catch (e) {
      console.warn("addToCart - analytics log failed:", e?.message || e);
    }
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
    let carts = await cartModel.find(query).populate("product_id");
    // normalize selected_image for each cart item similar to addToCart
    carts = carts.map((it) => {
      const prod = it.product_id || {};
      let selected = it.selected_image || null;
      if (
        !selected ||
        !Array.isArray(prod.product_images) ||
        !prod.product_images.includes(selected)
      ) {
        selected =
          Array.isArray(prod.product_images) && prod.product_images.length
            ? prod.product_images[0]
            : selected;
      }
      return Object.assign({}, it.toObject ? it.toObject() : it, {
        selected_image: selected,
        product_id: prod,
      });
    });
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

  try {
    const query = user_id
      ? {
          user_id,
          product_id,
          selected_image,
          selected_size: selected_size || null,
        }
      : {
          guest_id: guestId,
          product_id,
          selected_image,
          selected_size: selected_size || null,
        };
    let cart = await cartModel.findOne(query);

    if (!cart) {
      console.log("removeFromCart - Cart item not found:", query);
      res.status(404);
      throw new Error("Cart item not found");
    }

    // honor explicit removeAll flag if provided — delete regardless of quantity
    if (req.body.removeAll) {
      await cartModel.deleteOne({ _id: cart._id });
      console.log(
        "removeFromCart - removeAll requested, deleted cart item:",
        cart._id
      );
    } else if (cart.quantity > 1) {
      cart.quantity -= 1;
      await cart.save();
      console.log("removeFromCart - Decreased quantity:", cart._id);
    } else {
      await cartModel.deleteOne({ _id: cart._id });
      console.log("removeFromCart - Deleted cart item:", cart._id);
    }

    let updatedCarts = await cartModel
      .find(user_id ? { user_id } : { guest_id: guestId })
      .populate("product_id");
    updatedCarts = updatedCarts.map((it) => {
      const prod = it.product_id || {};
      let selected = it.selected_image || null;
      if (
        !selected ||
        !Array.isArray(prod.product_images) ||
        !prod.product_images.includes(selected)
      ) {
        selected =
          Array.isArray(prod.product_images) && prod.product_images.length
            ? prod.product_images[0]
            : selected;
      }
      return Object.assign({}, it.toObject ? it.toObject() : it, {
        selected_image: selected,
        product_id: prod,
      });
    });
    console.log(
      "removeFromCart - Returning updated cart:",
      updatedCarts.length
    );
    res.status(200).json(updatedCarts);
  } catch (err) {
    console.error("removeFromCart - Error:", err?.message || err);
    console.error(
      "removeFromCart - request body:",
      JSON.stringify(req.body).slice(0, 2000)
    );
    console.error(
      "removeFromCart - headers:",
      JSON.stringify(req.headers).slice(0, 2000)
    );
    res.status(500);
    throw err; // rethrow to include stack via error middleware
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
    highlights,
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
    highlights,
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
    // Check if product code already exists
    const existingProduct = await productModel.findOne({ product_code });
    if (existingProduct) {
      console.log("createProduct - Product code already exists:", product_code);
      res.status(409);
      throw new Error(
        `Product code "${product_code}" already exists. Please use a unique product code.`
      );
    }

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
      console.log("createProduct - Invalid prices:", {
        basePrice,
        discountedPrice,
      });
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
      for (const size of sizes) {
        if (!size.size || isNaN(size.stock) || size.stock < 0) {
          console.log("createProduct - Invalid size or stock:", size);
          res.status(400);
          throw new Error(
            "Size value is required and stock must be a non-negative number."
          );
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
      highlights: Array.isArray(highlights) ? highlights : [],
    });

    const populatedProduct = await productModel
      .findById(product._id)
      .populate("category")
      .populate("subcategories");
    console.log("createProduct - Created product:", product._id);
    res.status(201).json(populatedProduct);
  } catch (err) {
    console.error("createProduct - Error:", err.message);
    if (err.status) {
      res.status(err.status);
    } else if (err.code === 11000) {
      res.status(409);
      throw new Error(`Product code "${product_code}" already exists`);
    } else {
      res.status(500);
    }
    throw new Error(err.message || "Failed to create product");
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
    // Disable caching to ensure fresh product data
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
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
    // Add caching headers for better performance
    res.set("Cache-Control", "public, max-age=3600"); // Cache for 1 hour
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
    // Validate categoryId format early to avoid Mongoose cast errors
    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      console.warn(
        "getProductsByCategory - Invalid categoryId format:",
        categoryId
      );
      res.status(400);
      throw new Error("Invalid category ID format");
    }
    const products = await productModel
      .find({
        $or: [{ category: categoryId }, { subcategories: categoryId }],
      })
      .populate("category")
      .populate("subcategories")
      .populate("reviews");
    if (!products || products.length === 0) {
      console.log(
        "getProductsByCategory - No products found for category:",
        categoryId
      );
      // Return empty array so frontend can render an empty state instead of
      // receiving a 500. This is not an internal server error, it's a valid
      // empty result.
      return res.status(200).json([]);
    }
    console.log("getProductsByCategory - Found products:", products.length);
    res.status(200).json(products);
  } catch (err) {
    // Detailed logging for diagnostics
    console.error("getProductsByCategory - Error:", err);
    console.error(err.stack || err.message);
    // Return structured JSON to the client to aid frontend debugging
    return res.status(500).json({
      message: err.message || "Failed to fetch products",
      error: String(err),
    });
  }
});

const updateProduct = handler(async (req, res) => {
  console.log("updateProduct - Request params:", req.params);
  console.log("updateProduct - Request body:", req.body);

  try {
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log("updateProduct - Invalid product ID format:", req.params.id);
      res.status(400);
      throw new Error("Invalid product ID format");
    }

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
      highlights,
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
      product_stock !== undefined
        ? Number(product_stock)
        : product.product_stock;

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
      // Accept any non-empty size identifier and require a non-negative numeric stock
      for (const size of sizes) {
        if (!size.size || isNaN(Number(size.stock)) || Number(size.stock) < 0) {
          console.log("updateProduct - Invalid size or stock:", size);
          res.status(400);
          throw new Error(
            "Size value is required and stock must be a non-negative number."
          );
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
          product_description:
            product_description || product.product_description,
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
          highlights:
            highlights !== undefined ? highlights : product.highlights,
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
    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log("deleteProduct - Invalid product ID format:", req.params.id);
      res.status(400);
      throw new Error("Invalid product ID format");
    }

    const product = await productModel.findById(req.params.id);
    if (!product) {
      console.log("deleteProduct - Product not found:", req.params.id);
      res.status(404);
      throw new Error("Product not found");
    }

    // Delete in parallel for better performance
    await Promise.all([
      reviewModel.deleteMany({ product_id: req.params.id }),
      cartModel.deleteMany({ product_id: req.params.id }),
    ]);

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
    console.log(
      `getReviews - Found ${reviews.length} reviews for product_id: ${product_id}`
    );
    res.status(200).json(reviews);
  } catch (err) {
    console.error("getReviews - Error:", err.message);
    res.status(err.status || 500);
    throw new Error(err.message || "Failed to fetch reviews");
  }
});

// Add to Wishlist
const addToWishlist = handler(async (req, res) => {
  const { product_id, selected_image, guestId, selected_size } = req.body;
  const user_id = req.user?.id;

  if (!product_id || !selected_image) {
    res.status(400);
    throw new Error("Product ID and selected image are required");
  }

  if (!user_id && !guestId) {
    res.status(400);
    throw new Error("User or guest ID required");
  }

  if (!mongoose.Types.ObjectId.isValid(product_id)) {
    res.status(400);
    throw new Error("Invalid product ID");
  }

  const product = await productModel.findById(product_id);
  if (!product) {
    res.status(404);
    throw new Error("Product not found");
  }

  const query = user_id
    ? {
        user_id,
        product_id,
        selected_image,
        selected_size: selected_size || null,
      }
    : {
        guest_id: guestId,
        product_id,
        selected_image,
        selected_size: selected_size || null,
      };

  const existing = await wishlistModel.findOne(query);
  if (existing) {
    return res.status(200).json({ message: "Already in wishlist" });
  }

  const wishlistItem = await wishlistModel.create({
    user_id: user_id || null,
    guest_id: user_id ? null : guestId,
    product_id,
    selected_image,
    selected_size: selected_size || null,
  });

  // Populate and return full wishlist
  const wishlist = await wishlistModel
    .find(user_id ? { user_id } : { guest_id: guestId })
    .populate("product_id");

  // Normalize selected_image (same logic as cart)
  const normalizedWishlist = wishlist.map((item) => {
    const prod = item.product_id || {};
    let selected = item.selected_image;
    if (
      !selected ||
      !Array.isArray(prod.product_images) ||
      !prod.product_images.includes(selected)
    ) {
      selected = prod.product_images?.[0] || selected;
    }
    return { ...item.toObject(), selected_image: selected, product_id: prod };
  });

  res.status(201).json(normalizedWishlist);
});

// Remove from Wishlist
const removeFromWishlist = handler(async (req, res) => {
  const { product_id, selected_image, guestId, selected_size } = req.body;
  const user_id = req.user?.id;

  if (!product_id || !selected_image) {
    res.status(400);
    throw new Error("Product ID and selected image are required");
  }

  if (!user_id && !guestId) {
    res.status(400);
    throw new Error("User or guest ID required");
  }

  const query = user_id
    ? {
        user_id,
        product_id,
        selected_image,
        selected_size: selected_size || null,
      }
    : {
        guest_id: guestId,
        product_id,
        selected_image,
        selected_size: selected_size || null,
      };

  const result = await wishlistModel.deleteOne(query);

  if (result.deletedCount === 0) {
    res.status(404);
    throw new Error("Item not found in wishlist");
  }

  const wishlist = await wishlistModel
    .find(user_id ? { user_id } : { guest_id: guestId })
    .populate("product_id");

  const normalizedWishlist = wishlist.map((item) => {
    const prod = item.product_id || {};
    let selected = item.selected_image;
    if (
      !selected ||
      !Array.isArray(prod.product_images) ||
      !prod.product_images.includes(selected)
    ) {
      selected = prod.product_images?.[0] || selected;
    }
    return { ...item.toObject(), selected_image: selected, product_id: prod };
  });

  res.status(200).json(normalizedWishlist);
});

// Get My Wishlist
const getMyWishlist = handler(async (req, res) => {
  const user_id = req.user?.id;
  const { guestId } = req.query;

  if (!user_id && !guestId) {
    res.status(400);
    throw new Error("User or guest ID required");
  }

  const query = user_id ? { user_id } : { guest_id: guestId };

  let wishlist = await wishlistModel.find(query).populate("product_id");

  wishlist = wishlist.map((item) => {
    const prod = item.product_id || {};
    let selected = item.selected_image;
    if (
      !selected ||
      !Array.isArray(prod.product_images) ||
      !prod.product_images.includes(selected)
    ) {
      selected = prod.product_images?.[0] || selected;
    }
    return { ...item.toObject(), selected_image: selected, product_id: prod };
  });

  res.status(200).json(wishlist);
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
  getMyWishlist,
  removeFromWishlist,
  addToWishlist,
};
