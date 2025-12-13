const express = require("express");
const {
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
} = require("../controllers/productController");
const authHandler = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/products", getProducts); // Public access
router.get("/product/:id", getProductById); // Public access
router.get("/category/:categoryId", getProductsByCategory); // Public access
router.post("/create-product", createProduct); // Public access
router.put("/product/:id", updateProduct); // Public access
router.delete("/product/:id", deleteProduct); // Public access
router.post("/cart", authHandler, addToCart); // Apply authHandler
router.get("/cart", authHandler, getMyCart); // Apply authHandler
router.post("/cart/remove", authHandler, removeFromCart); // Apply authHandler
router.delete("/cart/clear", authHandler, clearCart); // Apply authHandler
router.post("/reviews/:productId", authHandler, submitReview); // Apply authHandler
router.get("/reviews/:productId", getReviews); // Public access
router.post("/wishlist/add", authHandler, addToWishlist); // optional auth — allows guest if guestId sent
router.post("/wishlist/remove", authHandler, removeFromWishlist);
router.get("/wishlist", authHandler, getMyWishlist);

module.exports = router;