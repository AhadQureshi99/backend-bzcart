const handler = require("express-async-handler");
const campaignModel = require("../models/campaignModel");
const userModel = require("../models/userModel");
const nodemailer = require("nodemailer");

const createCampaign = handler(async (req, res) => {
  const { subject, body } = req.body;

  if (!subject || !body) {
    res.status(400);
    throw new Error("Subject and body are required");
  }

  const campaign = await campaignModel.create({
    subject,
    body,
    createdBy: null, // No authentication, so no creator
  });

  res.status(201).json(campaign);
});

const getAllCampaigns = handler(async (req, res) => {
  const campaigns = await campaignModel
    .find()
    .populate("createdBy", "username email")
    .sort({ createdAt: -1 });
  res.status(200).json(campaigns);
});

const sendCampaign = handler(async (req, res) => {
  const { campaignId } = req.params;

  const campaign = await campaignModel.findById(campaignId);
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }

  if (campaign.sentAt) {
    res.status(400);
    throw new Error("Campaign already sent");
  }

  const users = await userModel.find({}, "email");
  const emails = users.map((user) => user.email);

  if (emails.length === 0) {
    res.status(400);
    throw new Error("No users to send email to");
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  const mailOptions = {
    from: "info@bzcart",
    bcc: emails, // Use BCC to hide recipients
    subject: campaign.subject,
    html: campaign.body,
  };

  try {
    await transporter.sendMail(mailOptions);
    campaign.sentAt = new Date();
    campaign.recipientCount = emails.length;
    await campaign.save();

    res
      .status(200)
      .json({ message: `Campaign sent to ${emails.length} users` });
  } catch (error) {
    console.error("Email send error:", error);
    res.status(500);
    throw new Error("Failed to send campaign emails");
  }
});

const deleteCampaign = handler(async (req, res) => {
  const { campaignId } = req.params;

  const campaign = await campaignModel.findById(campaignId);
  if (!campaign) {
    res.status(404);
    throw new Error("Campaign not found");
  }

  await campaignModel.deleteOne({ _id: campaignId });
  res.status(200).json({ message: "Campaign deleted successfully" });
});

module.exports = {
  createCampaign,
  getAllCampaigns,
  sendCampaign,
  deleteCampaign,
};
