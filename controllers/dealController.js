const handler = require("express-async-handler");
const dealModel = require("../models/dealModel");
const reviewModel = require("../models/reviewModel");
const Category = require("../models/categoryModel");
const mongoose = require("mongoose");

const createDeal = handler(async (req, res) => {
  const {
    deal_name,
    deal_description,
    original_price,
    deal_price,
    deal_stock,
    category,
    deal_code,
    rating,
    deal_expiry,
    bg_color,
    deal_images, // Expect array of URLs
  } = req.body;

  console.log("createDeal - req.body:", req.body); // Debugging

  if (
    !deal_name ||
    !original_price ||
    !deal_price ||
    !category ||
    !deal_code ||
    !deal_expiry
  ) {
    res.status(400);
    throw new Error("Please provide all required fields");
  }

  if (!deal_images || !Array.isArray(deal_images) || deal_images.length === 0) {
    res.status(400);
    throw new Error("At least one deal image is required");
  }

  const categoryExists = await Category.findById(category);
  if (!categoryExists || categoryExists.parent_category) {
    res.status(400);
    throw new Error("Invalid category ID or category is a subcategory");
  }

  const originalPrice = Number(original_price);
  const dealPrice = Number(deal_price);

  if (
    isNaN(originalPrice) ||
    isNaN(dealPrice) ||
    originalPrice <= 0 ||
    dealPrice <= 0
  ) {
    res.status(400);
    throw new Error("Prices must be valid positive numbers");
  }

  if (dealPrice > originalPrice) {
    res.status(400);
    throw new Error("Deal price cannot be higher than original price");
  }

  if (bg_color && !/^#[0-9A-F]{6}$/i.test(bg_color)) {
    res.status(400);
    throw new Error(
      "Invalid background color format. Use a hex code (e.g., #FFFFFF)"
    );
  }

  const dealExpiryDate = new Date(deal_expiry);
  if (isNaN(dealExpiryDate.getTime())) {
    res.status(400);
    throw new Error("Invalid deal expiry date");
  }

  const deal = await dealModel.create({
    deal_name,
    deal_description: deal_description || "",
    original_price: originalPrice,
    deal_price: dealPrice,
    deal_stock: Number(deal_stock) || 0,
    deal_images, // Store the array of URLs
    category,
    deal_code,
    rating: Number(rating) || 4,
    reviews: [],
    deal_expiry: dealExpiryDate,
    bg_color: bg_color || "#FFFFFF",
  });

  const populatedDeal = await dealModel
    .findById(deal._id)
    .populate("category")
    .populate("reviews");
  res.status(201).json(populatedDeal);
});

const getDeals = handler(async (req, res) => {
  const deals = await dealModel
    .find({ deal_expiry: { $gte: new Date() } })
    .populate("category")
    .populate("reviews");
  res.status(200).json(deals);
});

const getDealById = handler(async (req, res) => {
  const deal = await dealModel
    .findById(req.params.id)
    .populate("category")
    .populate("reviews");
  if (!deal) {
    res.status(404);
    throw new Error("Deal not found");
  }
  if (new Date(deal.deal_expiry) < new Date()) {
    res.status(410);
    throw new Error("Deal has expired");
  }
  res.status(200).json(deal);
});

const getDealsByCategory = handler(async (req, res) => {
  const categoryId = req.params.categoryId;
  const deals = await dealModel
    .find({
      category: categoryId,
      deal_expiry: { $gte: new Date() },
    })
    .populate("category")
    .populate("reviews");
  if (!deals || deals.length === 0) {
    res.status(404);
    throw new Error("No deals found in this category");
  }
  res.status(200).json(deals);
});

const updateDeal = handler(async (req, res) => {
  const deal = await dealModel.findById(req.params.id);
  if (!deal) {
    res.status(404);
    throw new Error("Deal not found");
  }

  const {
    deal_name,
    deal_description,
    original_price,
    deal_price,
    deal_stock,
    category,
    deal_code,
    rating,
    deal_expiry,
    bg_color,
    deal_images, // Expect array of URLs
  } = req.body;

  console.log("updateDeal - req.body:", req.body); // Debugging

  if (category) {
    const categoryExists = await Category.findById(category);
    if (!categoryExists || categoryExists.parent_category) {
      res.status(400);
      throw new Error("Invalid category ID or category is a subcategory");
    }
  }

  let originalPrice =
    original_price !== undefined ? Number(original_price) : deal.original_price;
  let dealPrice =
    deal_price !== undefined ? Number(deal_price) : deal.deal_price;

  if (
    original_price !== undefined &&
    (isNaN(originalPrice) || originalPrice <= 0)
  ) {
    res.status(400);
    throw new Error("Original price must be a positive number");
  }

  if (deal_price !== undefined && (isNaN(dealPrice) || dealPrice <= 0)) {
    res.status(400);
    throw new Error("Deal price must be a positive number");
  }

  if (
    original_price !== undefined &&
    deal_price !== undefined &&
    dealPrice > originalPrice
  ) {
    res.status(400);
    throw new Error("Deal price cannot be higher than original price");
  }

  if (bg_color && !/^#[0-9A-F]{6}$/i.test(bg_color)) {
    res.status(400);
    throw new Error(
      "Invalid background color format. Use a hex code (e.g., #FFFFFF)"
    );
  }

  if (deal_expiry) {
    const dealExpiryDate = new Date(deal_expiry);
    if (isNaN(dealExpiryDate.getTime())) {
      res.status(400);
      throw new Error("Invalid deal expiry date");
    }
  }

  const updatedDeal = await dealModel
    .findByIdAndUpdate(
      req.params.id,
      {
        deal_name: deal_name || deal.deal_name,
        deal_description: deal_description || deal.deal_description,
        original_price: originalPrice,
        deal_price: dealPrice,
        deal_stock:
          deal_stock !== undefined ? Number(deal_stock) : deal.deal_stock,
        deal_images: deal_images || deal.deal_images,
        category: category || deal.category,
        deal_code: deal_code || deal.deal_code,
        rating: Number(rating) || deal.rating,
        deal_expiry: deal_expiry ? new Date(deal_expiry) : deal.deal_expiry,
        bg_color: bg_color || deal.bg_color,
      },
      { new: true }
    )
    .populate("category")
    .populate("reviews");

  res.status(200).json(updatedDeal);
});

const deleteDeal = handler(async (req, res) => {
  console.log("deleteDeal - Request params:", req.params);

  const deal = await dealModel.findById(req.params.id);
  if (!deal) {
    console.log("deleteDeal - Deal not found for ID:", req.params.id);
    res.status(404);
    throw new Error("Deal not found");
  }

  await reviewModel.deleteMany({ product_id: req.params.id });
  await dealModel.findByIdAndDelete(req.params.id);

  console.log("deleteDeal - Deal deleted successfully:", req.params.id);
  res.status(200).json({ message: "Deal deleted successfully" });
});

module.exports = {
  createDeal,
  getDeals,
  getDealById,
  getDealsByCategory,
  updateDeal,
  deleteDeal,
};
