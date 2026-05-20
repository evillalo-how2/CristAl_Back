const express = require("express");
const router = express.Router();

const servicesController = require("../controllers/services.controller");

const {
  authenticateToken
} = require("../middlewares/auth.middleware");

const {
  authorizeRoles
} = require("../middlewares/roles.middleware");

// Rutas públicas
router.get("/", servicesController.getAllServices);
router.get("/:id", servicesController.getServiceById);

// Rutas protegidas: solo developer
router.post(
  "/",
  authenticateToken,
  authorizeRoles("developer"),
  servicesController.createNewService
);

router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("developer"),
  servicesController.updateExistingService
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("developer"),
  servicesController.deleteExistingService
);

module.exports = router;