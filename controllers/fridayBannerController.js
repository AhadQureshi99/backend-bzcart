const FridayBanner = require("../models/fridayBannerModel");

exports.createBanner = async (req, res) => {
  try {
    const { title, buttonText, buttonLink, timer } = req.body;

    let image = null;
    let video = null;

    if (req.files?.image) {
      image = req.files.image[0].buffer.toString("base64");
    }
    if (req.files?.video) {
      video = req.files.video[0].buffer.toString("base64");
    }

    if (!image && !video) {
      return res.status(400).json({ message: "Image or Video is required" });
    }

    const newBanner = await FridayBanner.create({
      image,
      video,
      title,
      buttonText,
      buttonLink,
      timer,
    });

    res.status(201).json(newBanner);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

exports.getBanner = async (req, res) => {
  try {
    const banner = await FridayBanner.findOne().sort({ createdAt: -1 });
    res.json(banner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteBanner = async (req, res) => {
  try {
    await FridayBanner.findByIdAndDelete(req.params.id);
    res.json({ message: "Banner deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
