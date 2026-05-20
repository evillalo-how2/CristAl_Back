const express = require("express");
const router = express.Router();

const {
  getActivePromotions
} = require("../controllers/promotions.controller");

const {
  authenticateToken
} = require("../middlewares/auth.middleware");

router.get("/", authenticateToken, getActivePromotions);

module.exports = router;