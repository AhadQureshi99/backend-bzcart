const handler = require("express-async-handler");
const Category = require("../models/categoryModel");
const Product = require("../models/productModel");
const mongoose = require("mongoose");

const createCategory = handler(async (req, res) => {
  const { name, parent_category, image } = req.body;
  if (!name) {
    res.status(400);
    throw new Error("Category name is required");
  }

  const category = await Category.create({
    name,
    parent_category: parent_category || null,
    image: image || "",
  });

  res.status(201).json(category);
});

const getCategories = handler(async (req, res) => {
  const categories = await Category.find().populate("parent_category");
  res.status(200).json(categories);
});

const getCategoryById = handler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid category ID");
  }
  const category = await Category.findById(req.params.id).populate("parent_category");
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }
  res.status(200).json(category);
});

const updateCategory = handler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid category ID");
  }
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  const { name, parent_category, image } = req.body;

  // Update name if provided
  category.name = name || category.name;

  // Handle parent_category
  category.parent_category =
    parent_category === "" || parent_category === undefined
      ? null
      : parent_category;

  // Handle image update
  category.image = image || category.image;

  // Validate parent_category if provided
  if (parent_category && parent_category !== "") {
    if (!mongoose.isValidObjectId(parent_category)) {
      res.status(400);
      throw new Error("Invalid parent category ID");
    }
    const parentExists = await Category.findById(parent_category);
    if (!parentExists) {
      res.status(404);
      throw new Error("Parent category not found");
    }
    if (parent_category === req.params.id) {
      res.status(400);
      throw new Error("Category cannot be its own parent");
    }
  }

  const updatedCategory = await category.save();
  res.status(200).json(updatedCategory);
});

const deleteCategory = handler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400);
    throw new Error("Invalid category ID");
  }
  const category = await Category.findById(req.params.id);
  if (!category) {
    res.status(404);
    throw new Error("Category not found");
  }

  try {
    const subcategories = await Category.find({ parent_category: req.params.id });
    const products = await Product.find({ $or: [{ category: req.params.id }, { subcategories: req.params.id }] });

    if (subcategories.length > 0) {
      res.status(400);
      throw new Error(`Cannot delete category: ${subcategories.length} subcategory(ies) associated`);
    }
    if (products.length > 0) {
      res.status(400);
      throw new Error(`Cannot delete category: ${products.length} product(s) associated`);
    }

    await Category.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error(`Delete category error for ID ${req.params.id}:`, error);
    res.status(500);
    throw new Error("Server error during category deletion");
  }
});

module.exports = {
  createCategory,
  getCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};