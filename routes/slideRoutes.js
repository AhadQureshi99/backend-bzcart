const express = require("express");
const authHandler = require("../middlewares/authMiddleware");
const {
  createSlide,
  getSlides,
  getSlideById,
  updateSlide,
  deleteSlide,
} = require("../controllers/slideController");

const slideRouter = express.Router();

slideRouter.post("/create-slide", createSlide);
slideRouter.get("/slides", getSlides);
slideRouter.get("/slide/:id", authHandler, getSlideById);
slideRouter.put("/slide/:id",  updateSlide);
slideRouter.delete("/slide/:id",  deleteSlide);

module.exports = slideRouter;