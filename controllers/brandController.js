const asyncHandler = require("express-async-handler");
const Brand = require("../models/brandModel");

// Add a new brand
const addBrand = asyncHandler(async (req, res) => {
  console.log("Received request to add brand:", req.body);
  const { image } = req.body;

  if (!image) {
    console.error("No image provided in request");
    res.status(400);
    throw new Error("Brand image is required");
  }

  const brand = await Brand.create({ image });
  console.log("Brand created:", brand);

  res.status(201).json({
    success: true,
    data: brand,
  });
});

// Get all brands
const getBrands = asyncHandler(async (req, res) => {
  console.log("Fetching all brands");
  const brands = await Brand.find().sort({ createdAt: -1 });
  console.log("Brands fetched:", brands);
  res.status(200).json({
    success: true,
    data: brands,
  });
});

// Delete a brand
const deleteBrand = asyncHandler(async (req, res) => {
  console.log("Received request to delete brand with id:", req.params.id);
  const brand = await Brand.findById(req.params.id);

  if (!brand) {
    console.error("Brand not found for id:", req.params.id);
    res.status(404);
    throw new Error("Brand not found");
  }

  await brand.deleteOne();
  console.log("Brand deleted:", req.params.id);

  res.status(200).json({
    success: true,
    data: { id: req.params.id },
  });
});

module.exports = { addBrand, getBrands, deleteBrand };
