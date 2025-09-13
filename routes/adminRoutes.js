const express = require("express");
const {
  registerAdmin,
  loginAdmin,
  createAdmin,
} = require("../controllers/adminController");
const authHandler = require("../middlewares/authMiddleware");
const roleHandler = require("../middlewares/roleMiddleware");
const adminRouter = express.Router();

adminRouter.post("/register-admin", authHandler, registerAdmin);
adminRouter.post("/login-admin", loginAdmin);
adminRouter.post(
  "/create-admin",
  authHandler,
  roleHandler(["superadmin"]),
  createAdmin
);

module.exports = adminRouter;
