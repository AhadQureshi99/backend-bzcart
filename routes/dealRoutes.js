const express = require("express");
const {
  createDeal,
  getDeals,
  getDealById,
  getDealsByCategory,
  updateDeal,
  deleteDeal,
} = require("../controllers/dealController");

const router = express.Router();

router.get("/deals", getDeals);
router.get("/deal/:id", getDealById);
router.get("/deals/category/:categoryId", getDealsByCategory);
router.post("/create-deal", createDeal);
router.put("/deal/:id", updateDeal);
router.delete("/deal/:id", deleteDeal);

module.exports = router;
