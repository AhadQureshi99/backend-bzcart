// E:\bzbackfinal\controllers\reelController.js
const handler = require("express-async-handler");
const reelModel = require("../models/reelModel");

const createReel = handler(async (req, res) => {
  const { title, description, video_url, user_id } = req.body;

  if (!title || !video_url) {
    console.log("createReel - Missing required fields:", { title, video_url });
    res.status(400);
    throw new Error("Title and video URL are required");
  }

  const reel = await reelModel.create({
    title,
    description: description || "",
    video_url,
    user_id: user_id || null, // Optional user_id, defaults to null
  });

  const populatedReel = await reelModel
    .findById(reel._id)
    .populate("user_id", "username");
  console.log("createReel - Created reel:", populatedReel);
  res.status(201).json(populatedReel);
});

const getReels = handler(async (req, res) => {
  const reels = await reelModel.find().populate("user_id", "username");
  console.log(`getReels - Found ${reels.length} reels`);
  res.status(200).json(reels);
});

const getReelById = handler(async (req, res) => {
  const reel = await reelModel
    .findById(req.params.id)
    .populate("user_id", "username");
  if (!reel) {
    console.log(`getReelById - Reel not found for ID: ${req.params.id}`);
    res.status(404);
    throw new Error("Reel not found");
  }
  res.status(200).json(reel);
});

const deleteReel = handler(async (req, res) => {
  const reel = await reelModel.findById(req.params.id);
  if (!reel) {
    console.log(`deleteReel - Reel not found for ID: ${req.params.id}`);
    res.status(404);
    throw new Error("Reel not found");
  }

  await reelModel.findByIdAndDelete(req.params.id);
  console.log(`deleteReel - Reel deleted successfully: ${req.params.id}`);
  res.status(200).json({ message: "Reel deleted successfully" });
});

module.exports = {
  createReel,
  getReels,
  getReelById,
  deleteReel,
};