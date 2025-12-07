const express = require("express");
const errorHandler = require("./middlewares/errorMiddleware");
const connectDB = require("./config/connectDB");
const multer = require("multer");
const http = require("http");

const app = express();
const server = http.createServer(app);
const path = require("path");

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
    // Reject full URLs and other obviously invalid route strings early.
    if (/:\/\//.test(trimmedPath) || /^https?:/i.test(trimmedPath)) {
      console.warn(
        `Rejected route path that appears to be a URL: "${trimmedPath}" -> using "/" instead`
      );
      return "/";
    }

    // If a colon appears but it's not used as a route parameter (i.e. not "/:param"),
    // reject it to avoid path-to-regexp parsing errors (e.g. stray colons).
    if (trimmedPath.includes(":")) {
      const hasValidParam = /\/:\w+/.test(trimmedPath);
      if (!hasValidParam) {
        console.warn(
          `Rejected route path containing stray colon: "${trimmedPath}" -> using "/" instead`
        );
        return "/";
      }
    }

    // Accept the sanitized path
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

// Note: previously this file contained a custom `express.Router` override
// that attempted to sanitize and defensively register route paths. The
// override was removed because it interfered with normal route parsing
// and could cause the application to crash at startup when fed
// unexpected route strings. Express's default router behavior is used
// instead.

// Safe require function with better error reporting
function safeRequire(modulePath) {
  try {
    return require(modulePath);
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

// CORS disabled - using manual CORS headers middleware instead
// The cors package was causing path-to-regexp parsing errors.

// Manual CORS headers middleware (replaces the problematic cors package)
app.use((req, res, next) => {
  const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://dashboards.bzcart.store",
    "https://bz-cart-d-ashboard.vercel.app",
    "https://dashboardbzcart.vercel.app",
    "https://dashboard.bzcart.store",
    "https://dashboards.bzcart.store",
    "https://bzcart.store",
    "https://www.bzcart.store",
    "https://api.bzcart.store",
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }

  res.header(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Accept, Origin, X-Requested-With"
  );
  res.header("Access-Control-Allow-Credentials", "true");

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// Middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: false, limit: "50mb" }));

// Serve uploaded images folder publicly with caching headers for better performance
app.use(
  "/images",
  express.static(path.join(__dirname, "images"), {
    maxAge: "1d", // Cache images for 1 day
    etag: true, // Enable ETag for cache validation
  })
);

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

// Register all routes
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

// Upload processing route (server-side conversion to webp <=100KB)
registerRoutes(
  "/api/uploads",
  require("./routes/uploadRoutes"),
  "uploadRoutes"
);

// Multer error handling
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `Upload error: ${err.message}` });
  }
  next(err);
});

// Middleware for parsing JSON and URL-encoded bodies (already applied above)
// Keep a single set of body parsers to avoid duplicate middleware registrations.

// Additional routes not registered via `registerRoutes` above
// (Most routes are registered earlier through `registerRoutes`.)
// Only register the Friday-banner routes here to avoid duplicate
// registration of modules that were already registered above.
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
