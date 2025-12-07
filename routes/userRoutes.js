const express = require("express");
const {
  getCurrentUser,
  registerUser,
  loginUser,
  verifyOTP,
  getAllUsers,
  subscribeUser,
  validateDiscountCode,
  forgotPassword,
  resetPassword,
  updateProfileImage,
} = require("../controllers/userController");
const authHandler = require("../middlewares/authMiddleware");

const userRouter = express.Router();

userRouter.post("/register-user", registerUser);
userRouter.post("/login-user", loginUser);
userRouter.post("/verify-otp", authHandler, verifyOTP);
userRouter.get("/me", authHandler, getCurrentUser);
userRouter.get("/all-users", getAllUsers);
userRouter.post("/subscribe", subscribeUser);
userRouter.post("/validate-discount", validateDiscountCode);
userRouter.post("/forgot-password", forgotPassword);
userRouter.post("/reset-password", resetPassword);
userRouter.patch("/profile-image", authHandler, updateProfileImage);

module.exports = userRouter;
