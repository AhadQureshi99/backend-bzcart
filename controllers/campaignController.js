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

  const FORCE_MAIL_FROM = '"info@bzcart.store" <info@bzcart.store>';
  const FAVICON_PATH = path.resolve(__dirname, "..", "images", "IMG_3765.PNG");

  const mailOptions = {
    from: FORCE_MAIL_FROM,
    bcc: emails, // Use BCC to hide recipients
    subject: campaign.subject,
    // Wrap the stored campaign.body inside a basic email template so we
    // always include the favicon and a visible logo at the top of the
    // message. Note: for real production emails, use an absolute URL or
    // CID attachments so recipients can load the image.
    html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <link rel="icon" href="cid:favicon" type="image/png" />
  <title>${campaign.subject}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    /* Email client resets */
    body, #bodyTable {
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      height: 100% !important;
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      height: auto;
      line-height: 100%;
      outline: none;
      text-decoration: none;
    }
    table {
      border-collapse: collapse !important;
    }
    .campaign-container {
      max-width: 600px !important;
      margin: 20px auto !important;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .campaign-header {
      background: #ffa500;
      color: #ffffff;
      text-align: center;
      padding: 20px;
      font-family: Arial, Helvetica, sans-serif;
    }
    .campaign-body {
      padding: 30px 20px;
      color: #333333;
      font-family: Arial, Helvetica, sans-serif;
      line-height: 1.6;
    }
    /* Mobile styles */
    @media screen and (max-width: 600px) {
      .campaign-container {
        width: 100% !important;
        margin: 10px auto !important;
      }
      .campaign-body {
        padding: 20px 15px !important;
      }
      /* Force table cells into full width rows */
      table[class="responsive-table"],
      table[class="responsive-table"] tbody,
      table[class="responsive-table"] tr,
      table[class="responsive-table"] td {
        display: block !important;
        width: 100% !important;
        clear: both;
      }
      /* Adjust images for mobile */
      img[class="responsive-img"] {
        height: auto !important;
        max-width: 100% !important;
        width: 100% !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f6f6f6;">
  <!--[if mso]>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center">
  <tr><td>
  <![endif]-->
  <div class="campaign-container">
    <div class="campaign-header">
        <table role="presentation" width="100%" style="border:none;">
          <tr>
            <td style="text-align:center;">
              <img src="cid:favicon" alt="BZ Cart" width="80" height="80" style="vertical-align:middle;border-radius:8px;margin-right:12px;display:inline-block;" />
              <h1 style="margin:0;display:inline-block;vertical-align:middle;font-size:24px;color:#ffffff;">BZ Cart</h1>
            </td>
          </tr>
        </table>
      </div>
    <div class="campaign-body">
      ${campaign.body}
    </div>
  </div>
  <!--[if mso]>
  </td></tr>
  </table>
  <![endif]-->
</body>
</html>`,
    attachments: [
      {
        filename: "favicon.png",
        path: FAVICON_PATH,
        cid: "favicon",
        contentDisposition: "inline",
      },
    ],
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
