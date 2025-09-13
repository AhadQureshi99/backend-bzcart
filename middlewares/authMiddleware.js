const handler = require("express-async-handler");
const userModel = require("../models/userModel");
const jwt = require("jsonwebtoken");

const authHandler = handler(async (req, res, next) => {
  let token;

  console.log("authHandler - Headers:", req.headers);

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];
      console.log("authHandler - Token:", token);

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("authHandler - Decoded JWT:", decoded);

      req.user = await userModel.findById(decoded.id).select("-password");
      if (!req.user) {
        console.log("authHandler - User not found for ID:", decoded.id);
        res.status(401);
        throw new Error("User not found for the provided token");
      }

      console.log("authHandler - User authenticated:", req.user._id.toString());
      next();
    } catch (error) {
      console.error("authHandler - Error:", error.message);
      res.status(401);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  } else {
    console.log("authHandler - No token provided in headers");
    res.status(401);
    throw new Error("No token provided in Authorization header");
  }
});

module.exports = authHandler;