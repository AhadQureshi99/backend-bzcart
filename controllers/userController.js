const handler = require("express-async-handler");
const userModel = require("../models/userModel");
const tempUserModel = require("../models/tempUserModel");
const discountCodeModel = require("../models/discountCodeModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const generateOTP = () => {
  return crypto.randomInt(100000, 999999); // Secure OTP generation
};

const generateDiscountCode = () => {
  return crypto.randomBytes(4).toString("hex").toUpperCase(); // Generate 8-character code
};

const sendOTP = (email, otp) => {
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
    subject: "OTP Verification",
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
      <p>Use the following OTP to complete your registration process:</p>
      <div class="otp">${otp}</div>
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
      console.error("Email error:", error);
      throw new Error("Failed to send OTP email");
    } else {
      console.log("Mail sent successfully:", info.response);
    }
  });
};

const sendDiscountCode = (email, code) => {
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
    subject: "Your Exclusive 10% Discount Code",
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Discount Code</title>
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
    .code {
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
      Your 10% Discount Code
    </div>
    <div class="body">
      <p>Thank you for subscribing! Use the following code at checkout to get 10% off your first order:</p>
      <div class="code">${code}</div>
      <p class="note">This code is valid for 7 days and can be used once with Cash on Delivery.</p>
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
      console.error("Email error:", error);
      throw new Error("Failed to send discount code email");
    } else {
      console.log("Discount code email sent successfully:", info.response);
    }
  });
};

const getCurrentUser = handler(async (req, res) => {
  const user_id = req.user?.id;
  console.log("userController - getCurrentUser: Called with user_id:", user_id);

  if (!user_id) {
    console.log("userController - getCurrentUser: No user authenticated");
    res.status(401);
    throw new Error("Not authorized, no user found");
  }

  try {
    const user = await userModel.findById(user_id).select("-password");
    if (!user) {
      console.log("userController - getCurrentUser: User not found:", user_id);
      res.status(404);
      throw new Error("User not found");
    }
    console.log("userController - getCurrentUser: Found user:", { id: user._id, email: user.email });
    res.status(200).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    console.error("userController - getCurrentUser: Error:", err.message);
    res.status(500);
    throw new Error("Failed to fetch user");
  }
});

const registerUser = handler(async (req, res) => {
  const { username, email, password } = req.body;

  console.log("userController - registerUser: Registering with:", { email });

  if (!username || !email || !password) {
    res.status(400);
    throw new Error("Please enter all the fields");
  }

  const findUser = await userModel.findOne({ email });
  const findTempUser = await tempUserModel.findOne({ email });

  if (findUser || findTempUser) {
    res.status(401);
    throw new Error("Email already exists!");
  }

  const hashedPass = await bcrypt.hash(password, 10);
  const myOTP = generateOTP();

  const tempUser = await tempUserModel.create({
    username,
    email,
    password: hashedPass,
    otp: myOTP,
  });

  sendOTP(email, myOTP);

  console.log("userController - registerUser: Success, tempUser:", tempUser._id);
  res.status(201).send({
    _id: tempUser._id,
    username: tempUser.username,
    email: tempUser.email,
    token: generateToken(tempUser._id),
  });
});

const verifyOTP = handler(async (req, res) => {
  const user_id = req.user._id;
  const { otp } = req.body;

  console.log("userController - verifyOTP: Verifying OTP for user_id:", user_id);

  if (!otp) {
    res.status(400);
    throw new Error("Please enter the OTP");
  }

  const findTempUser = await tempUserModel.findById(user_id);
  if (!findTempUser) {
    res.status(404);
    throw new Error("User not found or OTP expired");
  }

  if (findTempUser.otp == otp) {
    const createdUser = await userModel.create({
      username: findTempUser.username,
      email: findTempUser.email,
      password: findTempUser.password,
      role: "user",
    });

    await tempUserModel.deleteOne({ _id: user_id });

    console.log("userController - verifyOTP: Success, user:", createdUser._id);
    res.status(200).send({
      _id: createdUser._id,
      username: createdUser.username,
      email: createdUser.email,
      role: createdUser.role,
      token: generateToken(createdUser._id),
    });
  } else {
    res.status(401);
    throw new Error("Invalid OTP");
  }
});

const loginUser = handler(async (req, res) => {
  const { email, password } = req.body;

  console.log("userController - loginUser: Logging in with:", { email });

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
    console.log("userController - loginUser: Success, user:", findUser._id);
    res.status(200).send({
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

const getAllUsers = handler(async (req, res) => {
  console.log("userController - getAllUsers: Fetching all users");
  const users = await userModel.find({}, "_id username email role").lean();
  if (!users || users.length === 0) {
    res.status(404);
    throw new Error("No users found");
  }
  console.log("userController - getAllUsers: Found", users.length, "users");
  res.status(200).send(users);
});

const subscribeUser = handler(async (req, res) => {
  const { email } = req.body;

  console.log("userController - subscribeUser: Subscribing with:", { email });

  if (!email) {
    res.status(400);
    throw new Error("Please provide an email address");
  }

  const existingCode = await discountCodeModel.findOne({ email });
  if (existingCode) {
    res.status(400);
    throw new Error("A discount code has already been sent to this email");
  }

  const code = generateDiscountCode();
  await discountCodeModel.create({ email, code });
  sendDiscountCode(email, code);

  console.log("userController - subscribeUser: Success, code sent:", code);
  res.status(201).send({
    message: "Discount code sent to your email!",
  });
});

const validateDiscountCode = handler(async (req, res) => {
  const { email, code } = req.body;

  console.log("userController - validateDiscountCode: Validating code for:", { email, code });

  if (!email || !code) {
    res.status(400);
    throw new Error("Email and discount code are required");
  }

  const discount = await discountCodeModel.findOne({
    code: code.trim().toUpperCase(),
    email,
  });

  if (!discount) {
    console.log("userController - validateDiscountCode: Invalid code");
    res.status(400);
    return res.json({ isValid: false, message: "Invalid discount code" });
  }

  if (discount.isUsed) {
    console.log("userController - validateDiscountCode: Code already used");
    res.status(400);
    return res.json({
      isValid: false,
      message: "Discount code has already been used",
    });
  }

  if (discount.expiresAt < Date.now()) {
    console.log("userController - validateDiscountCode: Code expired");
    res.status(400);
    return res.json({ isValid: false, message: "Discount code has expired" });
  }

  console.log("userController - validateDiscountCode: Valid code");
  res.status(200).json({ isValid: true, message: "Valid discount code" });
});

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "15d",
  });
};

module.exports = {
  getCurrentUser,
  registerUser,
  loginUser,
  verifyOTP,
  getAllUsers,
  subscribeUser,
  validateDiscountCode,
};