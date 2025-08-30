const express = require("express");
const router = express.Router();
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
} = require("../controllers/productController");
const authHandler = require("../middlewares/authMiddleware");

router.get("/products", getProducts); // Public access
router.get("/product/:id", getProductById); // Public access
router.get("/category/:categoryId", getProductsByCategory); // Public access
router.post("/create-product", createProduct); // Public access
router.put("/product/:id", updateProduct); // Public access
router.delete("/product/:id", deleteProduct); // Public access
router.post("/cart", addToCart); // No auth
router.get("/cart", authHandler, getMyCart); // Requires auth
router.post("/cart/remove", authHandler, removeFromCart); // Requires auth
router.delete("/cart/clear", authHandler, clearCart); // Requires auth
router.post("/reviews/:productId", submitReview); // No auth
router.get("/reviews/:productId", getReviews); // Public access

module.exports = router;
