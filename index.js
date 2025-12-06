const express = require("express");
const errorHandler = require("./middlewares/errorMiddleware");
const connectDB = require("./config/connectDB");
const cors = require("cors");
const multer = require("multer");
const http = require("http");

const app = express();
const server = http.createServer(app);

// Safe path parsing function with comprehensive error handling
function safeParsePath(path) {
  if (typeof path !== "string") return path;

  const trimmedPath = path.trim();

  // Handle obviously invalid cases
  if (/^https?:\/\//i.test(trimmedPath)) {
    console.warn(
      `Invalid route path detected (appears to be a full URL): "${trimmedPath}". Replacing with root path "/"`
    );
    return "/";
  }

  // Handle malformed parameter syntax where colon is not preceded by a slash
  if (trimmedPath.startsWith(":") && !trimmedPath.startsWith("/:")) {
    console.warn(
      `Invalid route path detected (starts with lone colon): "${trimmedPath}". Replacing with root path "/"`
    );
    return "/";
  }

  try {
    // Attempt to parse the path with path-to-regexp's parse function (v8+)
    const ptre = require("path-to-regexp");
    const parser =
      ptre && typeof ptre.parse === "function"
        ? ptre.parse
        : typeof ptre === "function"
        ? ptre
        : null;
    if (parser) {
      parser(trimmedPath);
    } else {
      // if the library shape is unexpected, warn and continue — we already
      // sanitized obvious bad cases above (URLs and lone-colon starts)
      console.warn(
        "path-to-regexp parse unavailable, skipping deep parse for:",
        trimmedPath
      );
    }
    return trimmedPath;
  } catch (error) {
    if (error.message.includes("Missing parameter name")) {
      console.error(`Invalid route pattern detected: "${trimmedPath}"`);
      console.error(`Error: ${error.message}`);
      console.error(
        "This error occurs when a route contains an unescaped colon (:) that is interpreted as an incomplete parameter."
      );
      console.error(
        'Replacing invalid route with root path "/" to prevent application crash.'
      );
      return "/";
    }
    // For other parsing errors, re-throw so they can be handled normally
    throw error;
  }
}

// Create a safe router factory that validates all route paths
const originalRouter = express.Router;
express.Router = function (options) {
  const router = originalRouter.call(this, options);

  const methods = [
    "get",
    "post",
    "put",
    "delete",
    "patch",
    "options",
    "head",
    "all",
    "use",
  ];

  methods.forEach((method) => {
    const originalMethod = router[method];
    router[method] = function (path, ...handlers) {
      if (typeof path === "string") {
        const safePath = safeParsePath(path);
        return originalMethod.call(this, safePath, ...handlers);
      }
      return originalMethod.call(this, path, ...handlers);
    };
  });

  return router;
};

// Safe require function with better error reporting
function safeRequire(modulePath) {
  try {
    const module = require(modulePath);
    console.log(`✓ Successfully loaded module: ${modulePath}`);
    return module;
  } catch (error) {
    console.error(`✗ Failed to load module ${modulePath}:`, error.message);
    throw error;
  }
}

// Function to safely register routes
function registerRoutes(basePath, ...routeModules) {
  const routerName =
    routeModules.length > 0 &&
    typeof routeModules[routeModules.length - 1] === "string"
      ? routeModules.pop()
      : "unknown routes";

  try {
    const safeBasePath = safeParsePath(basePath);
    app.use(safeBasePath, ...routeModules);
    console.log(
      `✓ Successfully registered routes for: ${safeBasePath} (${routerName})`
    );
  } catch (error) {
    console.error(
      `✗ Error registering routes for ${routerName} at path "${basePath}":`,
      error.message
    );
    throw error;
  }
}

require("dotenv").config();

// Load route modules safely
let slideRouter,
  categoryRouter,
  productRouter,
  brandRouter,
  reelRouter,
  dealRoutes;

try {
  slideRouter = safeRequire("./routes/slideRoutes");
  categoryRouter = safeRequire("./routes/categoryRoutes");
  productRouter = safeRequire("./routes/productRoutes");
  brandRouter = safeRequire("./routes/brandRoutes");
  reelRouter = safeRequire("./routes/reelRoutes");
  dealRoutes = safeRequire("./routes/dealRoutes");
  campaignRoutes = safeRequire("./routes/campaignRoutes");
} catch (error) {
  console.error(
    "Failed to load one or more route modules. The application cannot start without valid route definitions."
  );
  throw error;
}

// CORS configuration
const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ||
  "http://localhost:5173,http://localhost:5174,http://localhost:5175,https://bz-cart-d-ashboard.vercel.app,https://dashboardbzcart.vercel.app,https://dashboard.bzcart.store,https://bzcart.store,https://www.bzcart.store,https://api.bzcart.store"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175",
      "https://bz-cart-d-ashboard.vercel.app",
      "https://dashboardbzcart.vercel.app",
      "https://dashboardbzcart.vercel.app/",
      "https://bz-cart.vercel.app",
      "https://www.bzcart.store",
      "https://bzcart.store",
      "https://www.dashboard.bzcart.store",
      "http://dashboards.bzcart.store",
      "https://dashboards.bzcart.store",
      "https://api.bzcart.store", // ✅ yeh add karoo
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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

// Connect to database
connectDB();

// Register all routes with path validation
registerRoutes("/api/users", require("./routes/userRoutes"), "userRoutes");
registerRoutes("/api/admins", require("./routes/adminRoutes"), "adminRoutes");
registerRoutes("/api/products", productRouter, "productRoutes");
registerRoutes(
  "/api/payment",
  require("./routes/paymentRoutes"),
  "paymentRoutes"
);
registerRoutes("/api/orders", require("./routes/orderRoutes"), "orderRoutes");
registerRoutes("/api/slides", upload, slideRouter, "slideRoutes");
registerRoutes("/api/categories", categoryRouter, "categoryRoutes");
registerRoutes("/api/brands", brandRouter, "brandRoutes");
registerRoutes("/api/reel", reelRouter, "reelRoutes");
registerRoutes("/api", dealRoutes, "dealRoutes");
registerRoutes("/api/campaigns", campaignRoutes, "campaignRoutes");
registerRoutes(
  "/api/analytics",
  require("./routes/analyticsRoutes"),
  "analyticsRoutes"
);

// Multer error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }
  next(err);
});

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
app.use("/api/friday-banner", require("./routes/fridayBannerRoutes"));

// Apply multer error handling after routes
// Named multer error handler (defined here so it can be referenced later)
function handleMulterError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }
  next(err);
}

app.use(handleMulterError);

// General error handling middleware
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 3003;

server.listen(PORT, () => {
  console.log(`Server started successfully on port: ${PORT}`);
});

// Graceful shutdown handling
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close((err) => {
    if (err) {
      console.error("Error during server shutdown:", err);
      process.exit(1);
    }
    console.log("Server closed successfully");
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT received, shutting down gracefully");
  server.close((err) => {
    if (err) {
      console.error("Error during server shutdown:", err);
      process.exit(1);
    }
    process.exit(0);
  });
});
