const {
  findPatientById,
  findPatientByPhoneOrEmail,
  createPatientFromPublicForm,
  findActiveServiceById,
  findServiceById,
  findProviderById,
  findProviderServiceAssignment,
  findOverlappingAppointment,
  findWorkingHourForAppointment,
  findCalendarBlockForAppointment,
  findWorkingHoursByProviderAndDate,
  findAppointmentsByProviderAndDate,
  findCalendarBlocksByProviderAndDate,
  findProvidersByServiceId,
  createAppointment: createAppointmentModel,
  findAppointmentsForPanel,
  findAppointmentDetailsById,
  findAppointmentForStatusUpdate,
  findAppointmentForReschedule,
  findOverlappingAppointmentForReschedule,
  updateAppointmentScheduleById,
  updateAppointmentStatusById,
} = require("../models/appointments.model");

const {
  syncAppointmentToGoogleCalendar,
  cancelGoogleCalendarEventForAppointment,
  updateGoogleCalendarEventForAppointment
} = require("../services/googleCalendar.service");

const getAllAppointments = async (req, res) => {
  try {
    const {
      status,
      provider_user_id,
      service_id,
      patient_id,
      date,
      start_date,
      end_date,
      limit,
      offset
    } = req.query;

    const appointments = await findAppointmentsForPanel({
      user: req.user,
      status,
      provider_user_id,
      service_id,
      patient_id,
      date,
      start_date,
      end_date,
      limit,
      offset
    });

    return res.json({
      appointments
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error getting appointments",
      error: error.message
    });
  }
};

const getAppointmentById = async (req, res) => {
  try {
    const appointment = await findAppointmentDetailsById(
      req.params.id,
      req.user
    );

    if (!appointment) {
      return res.status(404).json({
        message: "Appointment not found"
      });
    }

    return res.json({
      appointment
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error getting appointment",
      error: error.message
    });
  }
};

function normalizeTime(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  if (/^\d{2}:\d{2}$/.test(value)) {
    return `${value}:00`;
  }

  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
    return value;
  }

  return null;
}

function isValidDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function splitFullName(fullName) {
  const cleanedName = String(fullName || "").trim();
  const parts = cleanedName.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return {
      first_name: "",
      last_name: ""
    };
  }

  if (parts.length === 1) {
    return {
      first_name: parts[0],
      last_name: "No especificado"
    };
  }

  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" ")
  };
}

function normalizePublicPatient(patientPayload) {
  const patient = patientPayload || {};
  const nameParts = splitFullName(patient.name);

  return {
    first_name: String(patient.first_name || nameParts.first_name || "").trim(),
    last_name: String(patient.last_name || nameParts.last_name || "").trim(),
    phone: String(patient.phone || "").trim(),
    email: patient.email ? String(patient.email).trim() : null,
    preferred_contact_channel: patient.preferred_contact_channel || "whatsapp",
    notes: patient.notes || null
  };
}

function timeToMinutes(time) {
  const [hours, minutes] = String(time).slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");

  return `${hours}:${minutes}`;
}

function normalizeTimeForComparison(time) {
  return String(time).slice(0, 5);
}

function rangesOverlap(startA, endA, startB, endB) {
  return startA < endB && endA > startB;
}

function getBlockingReason(slotStart, slotEnd, appointments, blocks) {
  const appointmentConflict = appointments.find((appointment) => {
    const appointmentStart = timeToMinutes(
      normalizeTimeForComparison(appointment.start_time)
    );

    const appointmentEnd = timeToMinutes(
      normalizeTimeForComparison(appointment.end_time)
    );

    return rangesOverlap(slotStart, slotEnd, appointmentStart, appointmentEnd);
  });

  if (appointmentConflict) {
    return "occupied";
  }

  const blockConflict = blocks.find((block) => {
    if (Number(block.is_full_day) === 1) {
      return true;
    }

    if (!block.start_time || !block.end_time) {
      return false;
    }

    const blockStart = timeToMinutes(
      normalizeTimeForComparison(block.start_time)
    );

    const blockEnd = timeToMinutes(
      normalizeTimeForComparison(block.end_time)
    );

    return rangesOverlap(slotStart, slotEnd, blockStart, blockEnd);
  });

  if (blockConflict) {
    return "blocked";
  }

  return null;
}

const getAppointmentAvailability = async (req, res) => {
  try {
    const { provider_user_id, service_id, date } = req.query;

    const errors = [];

    if (!provider_user_id) errors.push("provider_user_id is required");
    if (!service_id) errors.push("service_id is required");

    if (!date || !isValidDateString(date)) {
      errors.push("date must use YYYY-MM-DD format");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation error",
        errors
      });
    }

    const service = await findServiceById(service_id);

    if (!service) {
      return res.status(404).json({
        message: "Service not found or inactive"
      });
    }

    const provider = await findProviderById(provider_user_id);

    if (!provider) {
      return res.status(404).json({
        message: "Provider not found or not available"
      });
    }

    const assignment = await findProviderServiceAssignment(
      provider_user_id,
      service_id
    );

    if (!assignment) {
      return res.status(409).json({
        message: "El proveedor seleccionado no atiende este servicio"
      });
    }

    const workingHours = await findWorkingHoursByProviderAndDate(
      provider_user_id,
      date
    );

    const appointments = await findAppointmentsByProviderAndDate(
      provider_user_id,
      date
    );

    const blocks = await findCalendarBlocksByProviderAndDate(
      provider_user_id,
      date
    );

    const durationMinutes = Number(service.duration_minutes) || 30;
    const slotStepMinutes = 30;
    const slots = [];

    const fullDayBlocked = blocks.some(
      (block) => Number(block.is_full_day) === 1
    );

    if (!fullDayBlocked) {
      const uniqueWorkingHours = [];

      for (const workingHour of workingHours) {
        const key = `${workingHour.start_time}-${workingHour.end_time}`;

        const alreadyAdded = uniqueWorkingHours.some(
          (item) => `${item.start_time}-${item.end_time}` === key
        );

        if (!alreadyAdded) {
          uniqueWorkingHours.push(workingHour);
        }
      }

      for (const workingHour of uniqueWorkingHours) {
        const workStart = timeToMinutes(
          normalizeTimeForComparison(workingHour.start_time)
        );

        const workEnd = timeToMinutes(
          normalizeTimeForComparison(workingHour.end_time)
        );

        for (
          let slotStart = workStart;
          slotStart + durationMinutes <= workEnd;
          slotStart += slotStepMinutes
        ) {
          const slotEnd = slotStart + durationMinutes;

          const reason = getBlockingReason(
            slotStart,
            slotEnd,
            appointments,
            blocks
          );

          slots.push({
            start_time: minutesToTime(slotStart),
            end_time: minutesToTime(slotEnd),
            available: !reason,
            reason
          });
        }
      }
    }

    return res.json({
      date,
      provider_user_id: Number(provider_user_id),
      service_id: Number(service_id),
      service: {
        id: service.id,
        name: service.name,
        duration_minutes: service.duration_minutes
      },
      slots
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error getting appointment availability",
      error: error.message
    });
  }
};

const createAppointment = async (req, res) => {
  try {
    const {
      patient_id,
      service_id,
      provider_user_id,
      appointment_date,
      source_channel = "web_form",
      patient_message = null
    } = req.body;

    const start_time = normalizeTime(req.body.start_time);
    const end_time = normalizeTime(req.body.end_time);

    const errors = [];

    if (!patient_id) errors.push("patient_id is required");
    if (!service_id) errors.push("service_id is required");
    if (!provider_user_id) errors.push("provider_user_id is required");

    if (!isValidDateString(appointment_date)) {
      errors.push("appointment_date must use YYYY-MM-DD format");
    }

    if (!start_time) {
      errors.push("start_time must use HH:mm or HH:mm:ss format");
    }

    if (!end_time) {
      errors.push("end_time must use HH:mm or HH:mm:ss format");
    }

    if (start_time && end_time && end_time <= start_time) {
      errors.push("end_time must be greater than start_time");
    }

    const allowedSourceChannels = [
      "web_form",
      "chatbot",
      "admin_panel",
      "phone",
      "whatsapp"
    ];

    if (!allowedSourceChannels.includes(source_channel)) {
      errors.push("source_channel is invalid");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation error",
        errors
      });
    }

    const patient = await findPatientById(patient_id);

    if (!patient) {
      return res.status(404).json({
        message: "Patient not found"
      });
    }

    const service = await findActiveServiceById(service_id);

    if (!service) {
      return res.status(404).json({
        message: "Service not found or inactive"
      });
    }

    const provider = await findProviderById(provider_user_id);

    if (!provider) {
      return res.status(404).json({
        message: "Provider not found or not available"
      });
    }

    const assignment = await findProviderServiceAssignment(
      provider_user_id,
      service_id
    );

    if (!assignment) {
      return res.status(409).json({
        message: "El proveedor seleccionado no atiende este servicio"
      });
    }

    const workingHour = await findWorkingHourForAppointment({
      provider_user_id,
      appointment_date,
      start_time,
      end_time
    });

    if (!workingHour) {
      return res.status(409).json({
        message: "El horario seleccionado está fuera del horario laboral del proveedor"
      });
    }

    const calendarBlock = await findCalendarBlockForAppointment({
      provider_user_id,
      appointment_date,
      start_time,
      end_time
    });

    if (calendarBlock) {
      return res.status(409).json({
        message: "El horario seleccionado está bloqueado en el calendario",
        reason: calendarBlock.reason
      });
    }

    const overlappingAppointment = await findOverlappingAppointment({
      provider_user_id,
      appointment_date,
      start_time,
      end_time
    });

    if (overlappingAppointment) {
      return res.status(409).json({
        message: "El horario seleccionado ya no está disponible"
      });
    }

    const appointment = await createAppointmentModel({
      patient_id,
      service_id,
      provider_user_id,
      appointment_date,
      start_time,
      end_time,
      source_channel,
      patient_message,
      status: "pending",
      created_by_user_id: null
    });

    const googleSyncResult = await syncAppointmentToGoogleCalendar(appointment);

    return res.status(201).json({
      message: "Appointment created successfully",
      data: appointment,
      google_calendar: googleSyncResult
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error creating appointment",
      error: error.message
    });
  }
};

const createPublicAppointment = async (req, res) => {
  try {
    const { patient, appointment } = req.body;

    if (!patient || !appointment) {
      return res.status(400).json({
        message: "patient and appointment are required"
      });
    }

    const normalizedPatient = normalizePublicPatient(patient);
    const errors = [];

    if (!normalizedPatient.first_name) {
      errors.push("patient.first_name or patient.name is required");
    }

    if (!normalizedPatient.last_name) {
      errors.push("patient.last_name is required");
    }

    if (!normalizedPatient.phone) {
      errors.push("patient.phone is required");
    }

    if (
      normalizedPatient.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedPatient.email)
    ) {
      errors.push("patient.email must be a valid email");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation error",
        errors
      });
    }

    let existingPatient = await findPatientByPhoneOrEmail({
      phone: normalizedPatient.phone,
      email: normalizedPatient.email
    });

    if (!existingPatient) {
      existingPatient = await createPatientFromPublicForm(normalizedPatient);
    }

    req.body = {
      patient_id: existingPatient.id,
      service_id: appointment.service_id,
      provider_user_id: appointment.provider_user_id,
      appointment_date: appointment.appointment_date,
      start_time: appointment.start_time,
      end_time: appointment.end_time,
      source_channel: appointment.source_channel || "web_form",
      patient_message: appointment.patient_message || null
    };

    return createAppointment(req, res);
  } catch (error) {
    return res.status(500).json({
      message: "Error creating public appointment",
      error: error.message
    });
  }
};

const updateAppointment = (req, res) => {
  res.json({
    message: `Update appointment with id ${req.params.id}`,
    data: req.body
  });
};

const deleteAppointment = (req, res) => {
  res.json({
    message: `Delete appointment with id ${req.params.id}`
  });
};

const getProvidersByService = async (req, res) => {
  try {
    const { service_id } = req.query;

    if (!service_id) {
      return res.status(400).json({
        message: "service_id is required"
      });
    }

    const service = await findServiceById(service_id);

    if (!service) {
      return res.status(404).json({
        message: "Service not found or inactive"
      });
    }

    const providers = await findProvidersByServiceId(service_id);

    return res.json({
      service: {
        id: service.id,
        name: service.name,
        duration_minutes: service.duration_minutes
      },
      providers: providers.map((provider) => ({
        id: provider.id,
        first_name: provider.first_name,
        last_name: provider.last_name,
        full_name: `${provider.first_name} ${provider.last_name}`,
        email: provider.email
      }))
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error getting providers by service",
      error: error.message
    });
  }
};

const updateAppointmentStatus = async (req, res) => {
  try {
    const { status, internal_notes = null } = req.body;

    const allowedStatuses = [
      "pending",
      "confirmed",
      "cancelled",
      "completed",
      "expired"
    ];

    if (!status) {
      return res.status(400).json({
        message: "status is required"
      });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: "Invalid appointment status",
        allowed_statuses: allowedStatuses
      });
    }

    const currentAppointment = await findAppointmentForStatusUpdate(
      req.params.id,
      req.user
    );

    if (!currentAppointment) {
      return res.status(404).json({
        message: "Appointment not found"
      });
    }

    let googleCalendarResult = null;

    if (
      status === "cancelled" &&
      currentAppointment.google_event_id &&
      currentAppointment.google_sync_status !== "cancelled"
    ) {
      googleCalendarResult = await cancelGoogleCalendarEventForAppointment(
        currentAppointment
      );
    } else if (status === "cancelled") {
      googleCalendarResult = {
        action: "skipped",
        synced: false,
        reason: "Appointment is not linked to a cancellable Google Calendar event"
      };
    }

    const updatedAppointment = await updateAppointmentStatusById({
      appointmentId: req.params.id,
      status,
      internal_notes,
      user: req.user
    });

    return res.json({
      message: "Appointment status updated successfully",
      appointment: updatedAppointment,
      google_calendar: googleCalendarResult
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error updating appointment status",
      error: error.message
    });
  }
};

const rescheduleAppointment = async (req, res) => {
  try {
    const {
      provider_user_id,
      appointment_date,
      internal_notes = null
    } = req.body;

    const start_time = normalizeTime(req.body.start_time);
    const end_time = normalizeTime(req.body.end_time);

    const errors = [];

    if (!provider_user_id) errors.push("provider_user_id is required");

    if (!isValidDateString(appointment_date)) {
      errors.push("appointment_date must use YYYY-MM-DD format");
    }

    if (!start_time) {
      errors.push("start_time must use HH:mm or HH:mm:ss format");
    }

    if (!end_time) {
      errors.push("end_time must use HH:mm or HH:mm:ss format");
    }

    if (start_time && end_time && end_time <= start_time) {
      errors.push("end_time must be greater than start_time");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: "Validation error",
        errors
      });
    }

    const currentAppointment = await findAppointmentForReschedule(
      req.params.id,
      req.user
    );

    if (!currentAppointment) {
      return res.status(404).json({
        message: "Appointment not found"
      });
    }

    if (["cancelled", "completed", "expired"].includes(currentAppointment.status)) {
      return res.status(409).json({
        message: "No se puede reprogramar una cita cancelada, completada o expirada"
      });
    }

    const provider = await findProviderById(provider_user_id);

    if (!provider) {
      return res.status(404).json({
        message: "Provider not found or not available"
      });
    }

    const assignment = await findProviderServiceAssignment(
      provider_user_id,
      currentAppointment.service_id
    );

    if (!assignment) {
      return res.status(409).json({
        message: "El proveedor seleccionado no atiende este servicio"
      });
    }

    const workingHour = await findWorkingHourForAppointment({
      provider_user_id,
      appointment_date,
      start_time,
      end_time
    });

    if (!workingHour) {
      return res.status(409).json({
        message: "El horario seleccionado está fuera del horario laboral del proveedor"
      });
    }

    const calendarBlock = await findCalendarBlockForAppointment({
      provider_user_id,
      appointment_date,
      start_time,
      end_time
    });

    if (calendarBlock) {
      return res.status(409).json({
        message: "El horario seleccionado está bloqueado en el calendario",
        reason: calendarBlock.reason
      });
    }

    const overlappingAppointment = await findOverlappingAppointmentForReschedule({
      appointment_id: currentAppointment.id,
      provider_user_id,
      appointment_date,
      start_time,
      end_time
    });

    if (overlappingAppointment) {
      return res.status(409).json({
        message: "El horario seleccionado ya no está disponible"
      });
    }

    const updatedAppointment = await updateAppointmentScheduleById({
      appointmentId: currentAppointment.id,
      provider_user_id,
      appointment_date,
      start_time,
      end_time,
      internal_notes,
      user: req.user
    });

    let googleCalendarResult = null;

    if (
      currentAppointment.google_event_id &&
      currentAppointment.google_sync_status === "synced"
    ) {
      googleCalendarResult = await updateGoogleCalendarEventForAppointment(
        updatedAppointment
      );
    } else {
      googleCalendarResult = {
        action: "skipped",
        synced: false,
        reason: "Appointment is not linked to a synced Google Calendar event"
      };
    }

    const finalAppointment = await findAppointmentDetailsById(
      currentAppointment.id,
      req.user
    );

    return res.json({
      message: "Appointment rescheduled successfully",
      appointment: finalAppointment,
      google_calendar: googleCalendarResult
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error rescheduling appointment",
      error: error.message
    });
  }
};

module.exports = {
  getAllAppointments,
  getAppointmentById,
  getAppointmentAvailability,
  getProvidersByService,
  createAppointment,
  createPublicAppointment,
  updateAppointment,
  rescheduleAppointment,
  deleteAppointment,
  updateAppointmentStatus
};