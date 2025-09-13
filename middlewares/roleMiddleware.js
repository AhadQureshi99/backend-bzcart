const handler = require("express-async-handler");

const roleHandler = (roles) =>
  handler(async (req, res, next) => {
    if (!req.user) {
      res.status(401);
      throw new Error("User not authenticated");
    }

    if (!roles.includes(req.user.role)) {
      res.status(403);
      throw new Error("Access denied: Insufficient permissions");
    }

    next();
  });

module.exports = roleHandler;
