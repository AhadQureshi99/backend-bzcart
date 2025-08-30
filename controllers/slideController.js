const handler = require("express-async-handler");
const slideModel = require("../models/slideModel");
const cloudinary = require("cloudinary").v2;

// Validate Cloudinary configuration
const validateCloudinaryConfig = () => {
  const requiredEnvVars = {
    cloud_name: process.env.Cloud_Name,
    api_key: process.env.API_Key,
    api_secret: process.env.API_Secret,
  };

  console.log("Cloudinary config:", {
    cloud_name: process.env.Cloud_Name,
    api_key: !!process.env.API_Key,
    api_secret: !!process.env.API_Secret,
  });

  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (!value) {
      throw new Error(`Missing Cloudinary environment variable: ${key}`);
    }
  }

  cloudinary.config({
    cloud_name: process.env.Cloud_Name,
    api_key: process.env.API_Key,
    api_secret: process.env.API_Secret,
  });
};

const createSlide = handler(async (req, res) => {
  console.log("createSlide - req.body:", req.body);
  console.log(
    "createSlide - req.files:",
    req.files
      ? Object.keys(req.files).map((key) => ({
          fieldname: req.files[key].fieldname,
          originalname: req.files[key].originalname,
          mimetype: req.files[key].mimetype,
          size: req.files[key].size,
        }))
      : "No files received"
  );

  const { title, subtitle, buttonText, link } = req.body;

  if (!title || !subtitle || !buttonText || !req.files?.image) {
    console.error("Missing required fields:", {
      title: !!title,
      subtitle: !!subtitle,
      buttonText: !!buttonText,
      image: !!req.files?.image,
    });
    res.status(400);
    throw new Error("Please provide all required fields, including an image");
  }

  try {
    // Validate Cloudinary configuration
    validateCloudinaryConfig();

    // Upload main image to Cloudinary
    const imageResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "slides" },
        (error, result) => {
          if (error) {
            console.error("Cloudinary upload error (image):", error.message);
            reject(new Error(`Cloudinary error: ${error.message}`));
          } else {
            resolve(result);
          }
        }
      );
      stream.end(req.files.image[0].buffer);
    });

    // Upload background image to Cloudinary if provided
    let backgroundUrl = null;
    if (req.files?.background) {
      const backgroundResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "slide_backgrounds" },
          (error, result) => {
            if (error) {
              console.error(
                "Cloudinary upload error (background):",
                error.message
              );
              reject(new Error(`Cloudinary error: ${error.message}`));
            } else {
              resolve(result);
            }
          }
        );
        stream.end(req.files.background[0].buffer);
      });
      backgroundUrl = backgroundResult.secure_url;
    }

    const slide = await slideModel.create({
      title,
      subtitle,
      buttonText,
      image: imageResult.secure_url,
      link: link || "/products",
      background: backgroundUrl,
    });

    res.status(201).json({
      _id: slide._id,
      title: slide.title,
      subtitle: slide.subtitle,
      buttonText: slide.buttonText,
      image: slide.image,
      link: slide.link,
      background: slide.background,
      createdAt: slide.createdAt,
    });
  } catch (error) {
    console.error("Error in createSlide:", error.message);
    res.status(500);
    throw new Error(`Failed to create slide: ${error.message}`);
  }
});

const getSlides = handler(async (req, res) => {
  const slides = await slideModel.find().sort({ createdAt: -1 });
  res.status(200).json(slides);
});

const getSlideById = handler(async (req, res) => {
  const slide = await slideModel.findById(req.params.id);

  if (!slide) {
    res.status(400);
    throw new Error("Slide not found");
  }

  res.status(200).json(slide);
});

const updateSlide = handler(async (req, res) => {
  console.log("updateSlide - req.body:", req.body);
  console.log(
    "updateSlide - req.files:",
    req.files
      ? Object.keys(req.files).map((key) => ({
          fieldname: req.files[key].fieldname,
          originalname: req.files[key].originalname,
          mimetype: req.files[key].mimetype,
          size: req.files[key].size,
        }))
      : "No files received"
  );

  const slide = await slideModel.findById(req.params.id);

  if (!slide) {
    res.status(400);
    throw new Error("Slide not found");
  }

  const { title, subtitle, buttonText, link } = req.body;

  try {
    // Validate Cloudinary configuration
    validateCloudinaryConfig();

    let imageUrl = slide.image;
    if (req.files?.image) {
      const imageResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "slides" },
          (error, result) => {
            if (error) {
              console.error("Cloudinary upload error (image):", error.message);
              reject(new Error(`Cloudinary error: ${error.message}`));
            } else {
              resolve(result);
            }
          }
        );
        stream.end(req.files.image[0].buffer);
      });
      imageUrl = imageResult.secure_url;
    }

    let backgroundUrl = slide.background;
    if (req.files?.background) {
      const backgroundResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "slide_backgrounds" },
          (error, result) => {
            if (error) {
              console.error(
                "Cloudinary upload error (background):",
                error.message
              );
              reject(new Error(`Cloudinary error: ${error.message}`));
            } else {
              resolve(result);
            }
          }
        );
        stream.end(req.files.background[0].buffer);
      });
      backgroundUrl = backgroundResult.secure_url;
    }

    const updatedSlide = await slideModel.findByIdAndUpdate(
      req.params.id,
      {
        title: title || slide.title,
        subtitle: subtitle || slide.subtitle,
        buttonText: buttonText || slide.buttonText,
        image: imageUrl,
        link: link || slide.link,
        background: backgroundUrl,
      },
      { new: true }
    );

    res.status(200).json(updatedSlide);
  } catch (error) {
    console.error("Error in updateSlide:", error.message);
    res.status(500);
    throw new Error(`Failed to update slide: ${error.message}`);
  }
});

const deleteSlide = handler(async (req, res) => {
  const slide = await slideModel.findById(req.params.id);

  if (!slide) {
    res.status(400);
    throw new Error("Slide not found");
  }

  await slideModel.findByIdAndDelete(req.params.id);
  res.status(200).json({ message: "Slide deleted successfully" });
});

module.exports = {
  createSlide,
  getSlides,
  getSlideById,
  updateSlide,
  deleteSlide,
};
