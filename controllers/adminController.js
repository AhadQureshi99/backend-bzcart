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
    service: "gmail",
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.MAIL_USER,
    to: email,
    subject: "OTP verification",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OTP Email Card</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f4f4f9;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: #007bff;
      color: #ffffff;
      text-align: center;
      padding: 20px;
      font-size: 24px;
    }
    .body {
      padding: 20px;
      text-align: center;
    }
    .otp {
      font-size: 32px;
      font-weight: bold;
      color: #333333;
      margin: 20px 0;
      letter-spacing: 4px;
    }
    .note {
      color: #555555;
      font-size: 14px;
      margin-top: 10px;
    }
    .cta-button {
      display: inline-block;
      margin-top: 20px;
      padding: 12px 30px;
      font-size: 16px;
      color: #ffffff;
      background: #007bff;
      border: none;
      border-radius: 6px;
      text-decoration: none;
      cursor: pointer;
    }
    .cta-button:hover {
      background: #0056b3;
    }
    .footer {
      background: #f4f4f9;
      padding: 10px;
      text-align: center;
      font-size: 12px;
      color: #888888;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="header">
      Verification Code
    </div>
    <div class="body">
      <p>Use the following OTP to complete your process:</p>
      <div class="otp">${otp}</div>
      <a href="http://localhost:3000/admin/otp/${id}" style='color:white;font-weight:bold;background:green;' class="cta-button">Verify Now</a>
      <p class="note">This OTP is valid for 10 minutes. Do not share it with anyone.</p>
    </div>
    <div class="footer">
      If you didn’t request this, please ignore this email or contact support.
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
