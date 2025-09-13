const express = require("express");
const router = express.Router();
const {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");

router.get("/categories", getCategories); // Public access
router.get("/category/:id", getCategoryById); // Public access
router.post("/create-category", createCategory); // Public access
router.put("/category/:id", updateCategory); // Public access
router.delete("/category/:id", deleteCategory); // Public access

module.exports = router;