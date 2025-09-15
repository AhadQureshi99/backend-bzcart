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
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Check both userModel and tempUserModel
      req.user = await userModel.findById(decoded.id).select("-password");
      if (!req.user) {
        req.user = await tempUserModel.findById(decoded.id).select("-password");
      }

      if (!req.user) {
        res.status(401);
        throw new Error("Not authorized, user not found");
      }

      next();
    } catch (error) {
      console.error(error);
      res.status(401);
      throw new Error("Not authorized, token failed");
    }
  } else {
    res.status(401);
    throw new Error("Not authorized, no token");
  }
});

module.exports = authHandler;
