const path = require("path");
const routes = [
  "../routes/slideRoutes",
  "../routes/categoryRoutes",
  "../routes/productRoutes",
  "../routes/brandRoutes",
  "../routes/reelRoutes",
  "../routes/dealRoutes",
  "../routes/paymentRoutes",
  "../routes/orderRoutes",
  "../routes/analyticsRoutes",
  "../routes/userRoutes",
  "../routes/adminRoutes",
  "../routes/webhookRoutes",
];

for (const r of routes) {
  try {
    console.log("Requiring", r);
    require(path.join(__dirname, r));
    console.log("OK:", r);
  } catch (err) {
    console.error("FAILED requiring", r);
    console.error(err && err.stack ? err.stack : err);
  }
}
console.log("Done");
