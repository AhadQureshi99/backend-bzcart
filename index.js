const express = require("express");
const errorHandler = require("./middlewares/errorMiddleware");
const connectDB = require("./config/connectDB");
const cors = require("cors");
const slideRouter = require("./routes/slideRoutes");
const categoryRouter = require("./routes/categoryRoutes");
const productRouter = require("./routes/productRoutes");
const brandRouter = require("./routes/brandRoutes");
const reelRouter = require("./routes/reelRoutes");
const dealRoutes = require("./routes/dealRoutes"); // Add this line

const multer = require("multer");

const app = express();

require("dotenv").config();
require("colors");

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "https://dashboardbzcart.vercel.app/",
      "https://bz-cart.vercel.app",
      "https://www.bzcart.store",
      "https://bzcart.store",
      "https://www.dashboard.bzcart.store",
      "http://dashboards.bzcart.store",
      "https://api.bzcart.store", // ✅ yeh add karo
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Connect to MongoDB
connectDB();

// Configure multer for slide routes only
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    fieldSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  },
}).fields([
  { name: "image", maxCount: 1 },
  { name: "background", maxCount: 1 },
]);

// Multer error handling middleware
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error("Multer error:", err.message, err);
    return res.status(400).json({ message: `Multer error: ${err.message}` });
  }
  next(err);
};

// Middleware for parsing JSON and URL-encoded bodies
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// Routes
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/admins", require("./routes/adminRoutes"));
app.use("/api/products", productRouter);
app.use("/api/payment", require("./routes/paymentRoutes"));
app.use("/api/orders", require("./routes/orderRoutes"));
app.use("/api/slides", upload, slideRouter);
app.use("/api/categories", categoryRouter);
app.use("/api/brands", brandRouter);
app.use("/api/reel", reelRouter);
app.use("/api", dealRoutes);

// Apply multer error handling after routes
app.use(handleMulterError);

// General error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`Server started on port: ${PORT}`.yellow));
