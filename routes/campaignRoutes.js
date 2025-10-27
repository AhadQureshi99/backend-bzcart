const express = require("express");
const {
  createCampaign,
  getAllCampaigns,
  sendCampaign,
  deleteCampaign,
} = require("../controllers/campaignController");
const authHandler = require("../middlewares/authMiddleware");
const roleHandler = require("../middlewares/roleMiddleware");

const campaignRouter = express.Router();

campaignRouter.post("/", createCampaign);
campaignRouter.get("/", getAllCampaigns);
campaignRouter.post("/:campaignId/send", sendCampaign);
campaignRouter.delete("/:campaignId", deleteCampaign);

module.exports = campaignRouter;
