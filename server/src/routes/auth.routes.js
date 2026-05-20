const express = require("express");
const router = express.Router();

const {
  login,
  registerPatient,
  getMe
} = require("../controllers/auth.controller");

const {
  authenticateToken
} = require("../middlewares/auth.middleware");

router.post("/login", login);
router.post("/register-patient", registerPatient);
router.get("/me", authenticateToken, getMe);

module.exports = router;