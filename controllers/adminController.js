const handler = require("express-async-handler");
const userModel = require("../models/adminModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const path = require("path");
// Force sender address + display name
const FORCE_MAIL_FROM = '"BZ Cart" <info@bzcart.store>';
const FAVICON_PATH = path.resolve(__dirname, "..", "images", "IMG_3765.PNG");

const generateOTP = () => {
  const randomNum = Math.random() * 1000000;
  const FloorNum = Math.floor(randomNum);
  return FloorNum;
};

const sendOTP = (email, otp, id) => {
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: parseInt(process.env.MAIL_PORT),
    secure: true,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  const mailOptions = {
    from: FORCE_MAIL_FROM,
    to: email,
    subject: "Your BZ Cart Admin Verification Code",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <link rel="icon" href="cid:favicon" type="image/png" />
  <title>BZ Cart - Admin OTP Verification</title>
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
    :root {
      color-scheme: light;
      supported-color-schemes: light;
    }
    /* Reset styles */
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
    /* Base styles */
    .email-container {
      max-width: 600px !important;
      margin: 20px auto !important;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #ffa500 0%, #ff8c00 100%);
      color: #ffffff !important;
      text-align: center;
      padding: 30px 20px;
    }
    .header-text {
      color: #ffffff;
      font-size: 28px;
      font-weight: bold;
      margin: 0;
      line-height: 1.3;
      font-family: Arial, sans-serif;
    }
    .logo {
      font-size: 36px;
      font-weight: bold;
      margin-bottom: 10px;
      font-family: Arial, sans-serif;
      color: #ffffff;
    }
    .body {
      padding: 40px 30px;
      text-align: center;
      background: #ffffff;
      font-family: Arial, sans-serif;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 20px;
      color: #555555;
      line-height: 1.6;
    }
    .otp {
      font-size: 48px;
      font-weight: bold;
      color: #ffa500 !important;
      margin: 30px auto;
      letter-spacing: 8px;
      background: #f9f9f9;
      padding: 20px;
      border-radius: 12px;
      border: 2px solid #ffa500;
      display: inline-block;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      font-family: Arial, sans-serif;
    }
    .note {
      color: #777777;
      font-size: 14px;
      margin-top: 20px;
      line-height: 1.6;
    }
    .footer {
      background: #f8f8f8;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #999999;
      border-top: 1px solid #e0e0e0;
      font-family: Arial, sans-serif;
    }
    .footer p {
      margin: 5px 0;
      line-height: 1.6;
    }
    .highlight {
      color: #ffa500 !important;
      font-weight: bold;
    }
    /* Outlook-specific styles */
    [owa] .email-container {
      min-width: 600px;
    }
    /* Mobile styles */
    @media screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        margin: 10px auto !important;
      }
      .header {
        padding: 20px 15px !important;
      }
      .header-text {
        font-size: 24px !important;
      }
      .logo {
        font-size: 32px !important;
      }
      .body {
        padding: 30px 20px !important;
      }
      .otp {
        font-size: 36px !important;
        letter-spacing: 6px !important;
        padding: 15px !important;
        width: 80% !important;
      }
      .greeting {
        font-size: 16px !important;
      }
      .note {
        font-size: 13px !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f6f6f6;font-family:Arial,sans-serif;">
  <!--[if mso]>
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" align="center" style="width:600px;">
  <tr><td style="padding:0px;">
  <![endif]-->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:600px;margin:0 auto;">
    <tr>
      <td>
        <div class="email-container">
          <div class="header" style="background:linear-gradient(135deg, #ffa500 0%, #ff8c00 100%);text-align:center;padding:30px 20px;">
            <table role="presentation" width="100%" style="border:none;">
              <tr>
                <td style="text-align:center;">
                  <img src="cid:favicon" alt="BZ Cart" width="48" height="48" style="vertical-align:middle;border-radius:6px;margin-right:8px;display:inline-block;" />
                  <span class="logo" style="display:inline-block;vertical-align:middle;color:#ffffff;font-weight:bold;">bzcart.store</span>
                  <div class="header-text" style="color:#ffffff;margin-top:6px;">Admin Verification Code</div>
                </td>
              </tr>
            </table>
          </div>
          <div class="body" style="background:#ffffff;padding:40px 30px;text-align:center;">
            <p class="greeting" style="color:#555555;margin-bottom:20px;">Hello Admin! Welcome to the BZ Cart management system.</p>
            <p style="color:#333333;margin-bottom:20px;">Use the following OTP to complete your admin verification process:</p>
            <div class="otp" style="color:#ffa500;background:#f9f9f9;display:inline-block;">${otp}</div>
            <p class="note" style="color:#777777;">This OTP is valid for <span class="highlight" style="color:#ffa500 !important;">10 minutes</span>. Do not share it with anyone for security reasons.</p>
          </div>
          <div class="footer" style="background:#f8f8f8;padding:20px;text-align:center;border-top:1px solid #e0e0e0;">
            <p style="color:#999999;margin:5px 0;">If you didn't request this, please ignore this email or contact our support team.</p>
            <p style="color:#999999;margin:5px 0;">&copy; 2023 BZ Cart. All rights reserved.</p>
          </div>
        </div>
      </td>
    </tr>
  </table>
  <!--[if mso]>
  </td></tr>
  </table>
  <![endif]-->
</body>
</html>`,
  };

  mailOptions.attachments = [
    {
      filename: "favicon.png",
      path: FAVICON_PATH,
      cid: "favicon",
      contentDisposition: "inline",
    },
  ];

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      throw new Error(error.message);
    } else {
      console.log("Mail sent successfully!");
    }
  });
};

const registerAdmin = handler(async (req, res) => {
  const { username, email, password, role } = req.body;

  if (!username || !email || !password) {
    res.status(400);
    throw new Error("Please enter all the fields");
  }

  const findUser = await userModel.findOne({ email });
  if (findUser) {
    res.status(401);
    throw new Error("Email already exists!");
  }

  // Only superadmin can specify a role (admin or superadmin)
  const isAdminCreation = role && ["admin", "superadmin"].includes(role);
  if (isAdminCreation && (!req.user || req.user.role !== "superadmin")) {
    res.status(403);
    throw new Error("Only superadmin can create admin or superadmin accounts");
  }

  const hashedPass = await bcrypt.hash(password, 10);
  const myOTP = generateOTP();

  const createdUser = await userModel.create({
    username,
    email,
    password: hashedPass,
    otp: myOTP,
    role: role && isAdminCreation ? role : "user",
  });

  sendOTP(email, myOTP, createdUser?._id);

  res.send({
    _id: createdUser._id,
    username: createdUser.username,
    email: createdUser.email,
    role: createdUser.role,
    token: generateToken(createdUser._id),
  });
});

const loginAdmin = handler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400);
    throw new Error("Please enter all the fields");
  }

  const findUser = await userModel.findOne({ email });
  if (!findUser) {
    res.status(404);
    throw new Error("Invalid Email");
  }

  if (await bcrypt.compare(password, findUser.password)) {
    res.send({
      _id: findUser._id,
      username: findUser.username,
      email: findUser.email,
      role: findUser.role,
      token: generateToken(findUser._id),
    });
  } else {
    res.status(401);
    throw new Error("Invalid password");
  }
});

const createAdmin = handler(async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    res.status(400);
    throw new Error("Please enter all the fields");
  }

  const findUser = await userModel.findOne({ email });
  if (findUser) {
    res.status(401);
    throw new Error("Email already exists!");
  }

  const hashedPass = await bcrypt.hash(password, 10);
  const myOTP = generateOTP();

  const createdUser = await userModel.create({
    username,
    email,
    password: hashedPass,
    otp: myOTP,
    role: "admin",
  });

  sendOTP(email, myOTP, createdUser?._id);

  res.send({
    _id: createdUser._id,
    username: createdUser.username,
    email: createdUser.email,
    role: createdUser.role,
    token: generateToken(createdUser._id),
  });
});

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "15d",
  });
};

module.exports = {
  registerAdmin,
  loginAdmin,
  createAdmin,
};
