const handler = require("express-async-handler");
const campaignModel = require("../models/campaignModel");
const userModel = require("../models/userModel");
const nodemailer = require("nodemailer");
const path = require("path");

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
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT),
    secure: true, // true for 465 port
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false, // Required for some GoDaddy configurations
    },
  });

  const FORCE_MAIL_FROM = '"BZ Cart" <info@bzcart.store>';

  const mailOptions = {
    from: FORCE_MAIL_FROM,
    bcc: emails, // Use BCC to hide recipients
    subject: campaign.subject,
    // Wrap the stored campaign.body inside a basic email template so we
    // always include the favicon and a visible logo at the top of the
    // message. Note: for real production emails, use an absolute URL or
    // CID attachments so recipients can load the image.
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${campaign.subject}</title>
  <link rel="icon" href="./images/IMG_3765.PNG" type="image/png" />
  <style>
    /* Minimal reset for campaign wrapper */
    body { font-family: Arial, Helvetica, sans-serif; margin:0; padding:0; }
    .campaign-container { max-width:600px; margin:20px auto; }
    .campaign-logo { text-align:center; padding:16px 0; }
  </style>
</head>
<body>
  <div class="campaign-container">
    <div class="campaign-logo">
      <!-- logo not embedded in emails per project requirement -->
    </div>
    <div class="campaign-body">
      ${campaign.body}
    </div>
  </div>
</body>
</html>`,
    // Logo not attached to campaign emails per project requirement
  };

  try {
    console.log("Attempting to send email campaign...");
    console.log("Mail options:", {
      ...mailOptions,
      to: "HIDDEN", // Don't log recipient emails
      bcc: "HIDDEN", // Don't log recipient emails
      recipientCount: emails.length,
    });

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully:", info.messageId);

    campaign.sentAt = new Date();
    campaign.recipientCount = emails.length;
    await campaign.save();

    res
      .status(200)
      .json({ message: `Campaign sent to ${emails.length} users` });
  } catch (error) {
    console.error("Email send error details:", {
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack,
    });
    res.status(500);
    throw new Error(`Failed to send campaign emails: ${error.message}`);
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
