const jwt = require("jsonwebtoken");
const handler = require("express-async-handler");
const userModel = require("../models/userModel");
const tempUserModel = require("../models/tempUserModel");

const authHandler = handler(async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      console.log("authHandler - Token received:", token.substring(0, 10) + "...");

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("authHandler - Decoded token:", decoded);

      // Check both userModel and tempUserModel
      req.user = await userModel.findById(decoded.id).select("-password");
      if (!req.user) {
        req.user = await tempUserModel.findById(decoded.id).select("-password");
      }

      if (!req.user) {
        console.log("authHandler - User not found for ID:", decoded.id);
        res.status(401);
        throw new Error("Not authorized, user not found");
      }

      console.log("authHandler - User authenticated:", {
        id: req.user._id,
        email: req.user.email,
      });
      next();
    } catch (error) {
      console.error("authHandler - Token verification failed:", error.message);
      res.status(401);
      throw new Error("Not authorized, token failed");
    }
  } else {
    // Allow unauthenticated requests to proceed (for guest users)
    console.log("authHandler - No token provided, proceeding as guest");
    req.user = null;
    next();
  }
});

module.exports = authHandler;