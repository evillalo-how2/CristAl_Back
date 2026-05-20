const express = require("express");
const router = express.Router();

const appointmentsController = require("../controllers/appointments.controller");

const {
  authenticateToken
} = require("../middlewares/auth.middleware");

const {
  authorizeRoles
} = require("../middlewares/roles.middleware");

// Disponibilidad "en tiempo real" para el calendario del frontend
router.get(
  "/availability",
  appointmentsController.getAppointmentAvailability
);

router.get(
  "/providers",
  appointmentsController.getProvidersByService
);

// Crear cita pública desde formulario web
router.post(
  "/public",
  appointmentsController.createPublicAppointment
);

router.post(
  "/",
  appointmentsController.createAppointment
);

// Rutas protegidas:
router.get(
  "/",
  authenticateToken,
  authorizeRoles("developer", "dentist", "assistant"),
  appointmentsController.getAllAppointments
);

router.patch(
  "/:id/status",
  authenticateToken,
  authorizeRoles("developer", "dentist", "assistant"),
  appointmentsController.updateAppointmentStatus
);

router.patch(
  "/:id/reschedule",
  authenticateToken,
  authorizeRoles("developer", "dentist", "assistant"),
  appointmentsController.rescheduleAppointment
);

router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("developer", "dentist", "assistant"),
  appointmentsController.getAppointmentById
);

router.get(
  "/:id",
  authenticateToken,
  authorizeRoles("developer", "dentist", "assistant"),
  appointmentsController.getAppointmentById
);

router.put(
  "/:id",
  authenticateToken,
  authorizeRoles("developer", "dentist", "assistant"),
  appointmentsController.updateAppointment
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRoles("developer", "assistant"),
  appointmentsController.deleteAppointment
);

module.exports = router;