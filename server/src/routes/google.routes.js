const express = require("express");
const router = express.Router();

const {
  startGoogleAuth,
  handleGoogleCallback
} = require("../controllers/google.controller");

const {
  authenticateToken
} = require("../middlewares/auth.middleware");

const {
  authorizeRoles
} = require("../middlewares/roles.middleware");

router.get(
  "/auth",
  authenticateToken,
  authorizeRoles("developer", "dentist"),
  startGoogleAuth
);

router.get("/callback", handleGoogleCallback);

module.exports = router;