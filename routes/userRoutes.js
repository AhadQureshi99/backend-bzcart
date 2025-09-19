const express = require("express");
const {
  registerUser,
  loginUser,
  verifyOTP,
  getAllUsers,
  subscribeUser,
  validateDiscountCode,
} = require("../controllers/userController");
const authHandler = require("../middlewares/authMiddleware");
const userRouter = express.Router();

userRouter.post("/register-user", registerUser);
userRouter.post("/login-user", loginUser);
userRouter.post("/verify-otp", authHandler, verifyOTP);
userRouter.get("/all-users", getAllUsers);
userRouter.post("/subscribe", subscribeUser);
userRouter.post("/validate-discount", validateDiscountCode);

module.exports = userRouter;
