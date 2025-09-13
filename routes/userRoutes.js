const express = require("express");
const {
  registerUser,
  loginUser,
  verifyOTP,
  getAllUsers,
} = require("../controllers/userController");
const authHandler = require("../middlewares/authMiddleware");
const userRouter = express.Router();

userRouter.post("/register-user", registerUser);
userRouter.post("/login-user", loginUser);
userRouter.post("/verify-otp", authHandler, verifyOTP);
userRouter.get("/all-users", getAllUsers);

module.exports = userRouter;
