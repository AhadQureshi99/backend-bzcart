const handler = require("express-async-handler");
const userModel = require("../models/adminModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

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
    from: process.env.MAIL_FROM,
    to: email,
    subject: "Your BZ Cart Admin Verification Code",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BZ Cart - Admin OTP Verification</title>
  <style>
    body {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      margin: 0;
      padding: 0;
      background: linear-gradient(135deg, #ffa500 0%, #ff8c00 100%);
      min-height: 100vh;
    }
    .email-container {
      max-width: 600px;
      margin: 40px auto;
      background: #ffffff;
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
      overflow: hidden;
      border: 1px solid #e0e0e0;
    }
    .header {
      background: linear-gradient(135deg, #ffa500 0%, #ff8c00 100%);
      color: #ffffff;
      text-align: center;
      padding: 30px 20px;
      font-size: 28px;
      font-weight: bold;
      position: relative;
    }
    .header::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: 80%;
      height: 4px;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 2px;
    }
    .logo {
      font-size: 36px;
      font-weight: bold;
      margin-bottom: 10px;
      text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }
    .body {
      padding: 40px 30px;
      text-align: center;
      color: #333333;
    }
    .greeting {
      font-size: 18px;
      margin-bottom: 20px;
      color: #555555;
    }
    .otp {
      font-size: 48px;
      font-weight: bold;
      color: #ffa500;
      margin: 30px 0;
      letter-spacing: 8px;
      background: #f9f9f9;
      padding: 20px;
      border-radius: 12px;
      border: 2px solid #ffa500;
      display: inline-block;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    }
    .note {
      color: #777777;
      font-size: 14px;
      margin-top: 20px;
      line-height: 1.5;
    }
    .footer {
      background: #f8f8f8;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #999999;
      border-top: 1px solid #e0e0e0;
    }
    .footer p {
      margin: 5px 0;
    }
    .highlight {
      color: #ffa500;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      <div class="logo">bzcart.store</div>
      Admin Verification Code
    </div>
    <div class="body">
      <p class="greeting">Hello Admin! Welcome to the BZ Cart management system.</p>
      <p>Use the following OTP to complete your admin verification process:</p>
      <div class="otp">${otp}</div>
      <p class="note">This OTP is valid for <span class="highlight">10 minutes</span>. Do not share it with anyone for security reasons.</p>
    </div>
    <div class="footer">
      <p>If you didn’t request this, please ignore this email or contact our support team.</p>
      <p>&copy; 2023 BZ Cart. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`,
  };

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
