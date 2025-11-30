const express = require("express");
const errorHandler = require("./middlewares/errorMiddleware");
const connectDB = require("./config/connectDB");
const cors = require("cors");
const multer = require("multer");
const http = require("http");

const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");

// Safe require function with detailed error reporting
function safeRequire(relPath) {
  try {
    const module = require(relPath);
    console.log(`✓ Successfully loaded module: ${relPath}`);
    return module;
  } catch (err) {
    console.error(`✗ Failed to load module ${relPath}:`, err.message);
    if (err.message.includes('Missing parameter name')) {
      console.error(`This error is caused by an invalid route pattern in ${relPath}.`);
      console.error(`The route contains an unescaped colon (:) that is being interpreted as a route parameter without a name.`);
    }
    throw err;
  }
}

// Function to safely register routes with detailed error reporting
function registerRoutes(basePath, router, routerName) {
  try {
    app.use(basePath, router);
    console.log(`✓ Successfully registered routes for: ${basePath}`);
  } catch (err) {
    console.error(`✗ Error registering routes for ${routerName} at path "${basePath}":`, err.message);
    if (err.message.includes('Missing parameter name')) {
      console.error(`This error indicates that one of the route patterns in ${routerName} contains an unescaped colon (:)`);
      console.error(`that is being interpreted as the start of a route parameter without a valid parameter name.`);
    }
    throw err;
  }
}

// Load route modules with error isolation
let slideRouter, categoryRouter, productRouter, brandRouter, reelRouter, dealRoutes;

try {
  slideRouter = safeRequire("./routes/slideRoutes");
  categoryRouter = safeRequire("./routes/categoryRoutes");
  productRouter = safeRequire("./routes/productRoutes");
  brandRouter = safeRequire("./routes/brandRoutes");
  reelRouter = safeRequire("./routes/reelRoutes");
  dealRoutes = safeRequire("./routes/dealRoutes");
} catch (error) {
  console.error("Error loading route modules. Please check the indicated route file for invalid route patterns.");
  throw error;
}

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://dashboardbzcart.vercel.app",
      "https://dashboard.bzcart.store",
      "https://bz-cart-d-ashboard.vercel.app",
      "https://bzcart.store",
      "http://localhost:5174",
      "http://localhost:5175",
    ],
    methods: ["GET", "POST"],
  },
});

app.set("io", io);

require("dotenv").config();

// CORS configuration
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "https://bz-cart-d-ashboard.vercel.app",
    "https://dashboardbzcart.vercel.app",
    "https://bzcart.store",
    "https://www.bzcart.store",
    "https://www.dashboard.bzcart.store",
    "https://dashboards.bzcart.store",
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
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

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// Connect to database
connectDB();

// Register routes with error isolation
registerRoutes("/api/users", require("./routes/userRoutes"), "userRoutes");
registerRoutes("/api/admins", require("./routes/adminRoutes"), "adminRoutes");
registerRoutes("/api/products", productRouter, "productRoutes");
registerRoutes("/api/payment", require("./routes/paymentRoutes"), "paymentRoutes");
registerRoutes("/api/orders", require("./routes/orderRoutes"), "orderRoutes");
registerRoutes("/api/slides", upload, slideRouter, "slideRoutes");
registerRoutes("/api/categories", categoryRouter, "categoryRoutes");
registerRoutes("/api/brands", brandRouter, "brandRoutes");
registerRoutes("/api/reel", reelRouter, "reelRoutes");
registerRoutes("/api", dealRoutes, "dealRoutes");
registerRoutes("/api/analytics", require("./routes/analyticsRoutes"), "analyticsRoutes");

// Multer error handling
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }
  next(err);
};

app.use(handleMulterError);

// Error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3003;

server.listen(PORT, () => {
  console.log(`Server started successfully on port: ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
  });
});