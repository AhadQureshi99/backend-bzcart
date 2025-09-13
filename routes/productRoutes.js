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
} = require("../controllers/productController");
const authHandler = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/products", getProducts); // Public access
router.get("/product/:id", getProductById); // Public access
router.get("/category/:categoryId", getProductsByCategory); // Public access
router.post("/create-product", createProduct); // Public access
router.put("/product/:id", updateProduct); // Public access
router.delete("/product/:id", deleteProduct); // Public access
router.post("/cart", addToCart); // No auth
router.get("/cart", getMyCart); // No auth (modified)
router.post("/cart/remove", removeFromCart); // No auth (modified)
router.delete("/cart/clear", clearCart); // No auth (modified)
router.post("/reviews/:productId", submitReview); // No auth
router.get("/reviews/:productId", getReviews); // Public access

module.exports = router;
