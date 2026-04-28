const express = require("express");
const router = express.Router();

const {
  getAllServices,
  getServiceById,
  createNewService,
  updateExistingService,
  deleteExistingService
} = require("../controllers/services.controller");

router.get("/", getAllServices);
router.get("/:id", getServiceById);
router.post("/", createNewService);
router.put("/:id", updateExistingService);
router.delete("/:id", deleteExistingService);

module.exports = router;