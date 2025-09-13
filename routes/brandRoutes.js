const express = require("express");
const {
  addBrand,
  getBrands,
  deleteBrand,
} = require("../controllers/brandController");

const router = express.Router();

router.route("/").post(addBrand).get(getBrands);
router.route("/:id").delete(deleteBrand);

module.exports = router;
