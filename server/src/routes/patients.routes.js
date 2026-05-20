const express = require("express");
const router = express.Router();

const patientsController = require("../controllers/patients.controller");

const {
  authenticateToken
} = require("../middlewares/auth.middleware");

const {
  authorizeRoles
} = require("../middlewares/roles.middleware");

router.use(authenticateToken);
router.use(authorizeRoles("developer", "dentist", "assistant"));

router.get("/", patientsController.getAllPatients);
router.get("/:id", patientsController.getPatientById);
router.post("/", patientsController.createPatient);
router.put("/:id", patientsController.updatePatient);
router.delete("/:id", patientsController.deletePatient);

module.exports = router;