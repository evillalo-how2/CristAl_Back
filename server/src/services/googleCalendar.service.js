const { google } = require("googleapis");
const db = require("../config/db");
const { createOAuthClient } = require("../config/google");

async function getActiveGoogleConnection() {
  const [rows] = await db.query(
    `
    SELECT
      id,
      user_id,
      google_email,
      calendar_id,
      access_token,
      refresh_token,
      expiry_date
    FROM google_calendar_connections
    WHERE is_active = 1
    ORDER BY updated_at DESC
    LIMIT 1
    `
  );

  return rows[0] || null;
}

async function getAppointmentDetailsForGoogle(appointmentId) {
  const [rows] = await db.query(
    `
    SELECT
      appointments.id,
      appointments.public_id,
      appointments.patient_id,
      appointments.service_id,
      appointments.provider_user_id,
      DATE_FORMAT(appointments.appointment_date, '%Y-%m-%d') AS appointment_date,
      appointments.start_time,
      appointments.end_time,
      appointments.status,
      appointments.source_channel,
      appointments.patient_message,

      patients.first_name AS patient_first_name,
      patients.last_name AS patient_last_name,
      patients.phone AS patient_phone,
      patients.email AS patient_email,

      services.name AS service_name,
      services.duration_minutes AS service_duration_minutes,

      providers.first_name AS provider_first_name,
      providers.last_name AS provider_last_name,
      providers.email AS provider_email
    FROM appointments
    INNER JOIN patients
      ON appointments.patient_id = patients.id
    INNER JOIN services
      ON appointments.service_id = services.id
    INNER JOIN users AS providers
      ON appointments.provider_user_id = providers.id
    WHERE appointments.id = ?
    LIMIT 1
    `,
    [appointmentId]
  );

  return rows[0] || null;
}

function buildGoogleEventFromAppointment(appointment) {
  const patientName = `${appointment.patient_first_name} ${appointment.patient_last_name}`.trim();
  const providerName = `${appointment.provider_first_name} ${appointment.provider_last_name}`.trim();
  const serviceName = appointment.service_name || `Servicio #${appointment.service_id}`;

  const descriptionLines = [
    `Paciente: ${patientName || "No especificado"}`,
    `Teléfono del paciente: ${appointment.patient_phone || "No especificado"}`,
    `Email del paciente: ${appointment.patient_email || "No especificado"}`,
    `Dentista: ${providerName || "No especificado"}`,
    `Servicio: ${serviceName}`,
    `Duración estimada: ${appointment.service_duration_minutes || "No especificada"} minutos`,
    `Origen: ${appointment.source_channel || "No especificado"}`,
    `Estado: ${appointment.status || "No especificado"}`,
    "",
    `Mensaje del paciente:`,
    appointment.patient_message || "Sin mensaje adicional.",
    "",
    `ID público de cita: ${appointment.public_id}`
  ];

  return {
    summary: `Cita dental - ${serviceName}`,
    description: descriptionLines.join("\n"),
    start: {
      dateTime: `${appointment.appointment_date}T${appointment.start_time}`,
      timeZone: "America/Chihuahua"
    },
    end: {
      dateTime: `${appointment.appointment_date}T${appointment.end_time}`,
      timeZone: "America/Chihuahua"
    }
  };
}

async function syncAppointmentToGoogleCalendar(appointment) {
  const connection = await getActiveGoogleConnection();

  if (!connection) {
    await db.query(
      `
      UPDATE appointments
      SET 
        google_sync_status = 'failed',
        google_sync_error = 'No active Google Calendar connection found'
      WHERE id = ?
      `,
      [appointment.id]
    );

    return {
      synced: false,
      reason: "No active Google Calendar connection found"
    };
  }

  const appointmentDetails = await getAppointmentDetailsForGoogle(appointment.id);

  if (!appointmentDetails) {
    await db.query(
      `
      UPDATE appointments
      SET 
        google_sync_status = 'failed',
        google_sync_error = 'Appointment details not found'
      WHERE id = ?
      `,
      [appointment.id]
    );

    return {
      synced: false,
      reason: "Appointment details not found"
    };
  }

  const oauth2Client = createOAuthClient();

  oauth2Client.setCredentials({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
    expiry_date: connection.expiry_date
  });

  const calendar = google.calendar({
    version: "v3",
    auth: oauth2Client
  });

  const event = buildGoogleEventFromAppointment(appointmentDetails);

  try {
    const response = await calendar.events.insert({
      calendarId: connection.calendar_id || "primary",
      requestBody: event
    });

    await db.query(
      `
      UPDATE appointments
      SET
        google_calendar_id = ?,
        google_event_id = ?,
        google_sync_status = 'synced',
        google_sync_error = NULL,
        google_synced_at = NOW()
      WHERE id = ?
      `,
      [
        connection.calendar_id || "primary",
        response.data.id,
        appointment.id
      ]
    );

    return {
      synced: true,
      google_event_id: response.data.id,
      htmlLink: response.data.htmlLink
    };
  } catch (error) {
    await db.query(
      `
      UPDATE appointments
      SET
        google_sync_status = 'failed',
        google_sync_error = ?
      WHERE id = ?
      `,
      [
        error.message,
        appointment.id
      ]
    );

    return {
      synced: false,
      reason: error.message
    };
  }
}

async function cancelGoogleCalendarEventForAppointment(appointment) {
  if (!appointment.google_event_id) {
    return {
      action: "skipped",
      synced: false,
      reason: "Appointment has no Google Calendar event"
    };
  }

  const connection = await getActiveGoogleConnection();

  if (!connection) {
    await db.query(
      `
      UPDATE appointments
      SET
        google_sync_status = 'failed',
        google_sync_error = 'No active Google Calendar connection found'
      WHERE id = ?
      `,
      [appointment.id]
    );

    return {
      action: "failed",
      synced: false,
      reason: "No active Google Calendar connection found"
    };
  }

  const oauth2Client = createOAuthClient();

  oauth2Client.setCredentials({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
    expiry_date: connection.expiry_date
  });

  const calendar = google.calendar({
    version: "v3",
    auth: oauth2Client
  });

  const calendarId =
    appointment.google_calendar_id ||
    connection.calendar_id ||
    "primary";

  try {
    await calendar.events.delete({
      calendarId,
      eventId: appointment.google_event_id
    });

    await db.query(
      `
      UPDATE appointments
      SET
        google_sync_status = 'cancelled',
        google_sync_error = NULL,
        google_synced_at = NOW()
      WHERE id = ?
      `,
      [appointment.id]
    );

    return {
      action: "deleted",
      synced: true,
      google_event_id: appointment.google_event_id,
      calendarId
    };
  } catch (error) {
    const googleStatus = error.response?.status || error.code;

    if (googleStatus === 404 || googleStatus === 410) {
      await db.query(
        `
        UPDATE appointments
        SET
          google_sync_status = 'cancelled',
          google_sync_error = NULL,
          google_synced_at = NOW()
        WHERE id = ?
        `,
        [appointment.id]
      );

      return {
        action: "already_deleted",
        synced: true,
        google_event_id: appointment.google_event_id,
        calendarId
      };
    }

    await db.query(
      `
      UPDATE appointments
      SET
        google_sync_status = 'failed',
        google_sync_error = ?
      WHERE id = ?
      `,
      [error.message, appointment.id]
    );

    return {
      action: "failed",
      synced: false,
      reason: error.message
    };
  }
}

async function updateGoogleCalendarEventForAppointment(appointment) {
  if (!appointment.google_event_id) {
    return {
      action: "skipped",
      synced: false,
      reason: "Appointment has no Google Calendar event"
    };
  }

  const connection = await getActiveGoogleConnection();

  if (!connection) {
    await db.query(
      `
      UPDATE appointments
      SET
        google_sync_status = 'failed',
        google_sync_error = 'No active Google Calendar connection found'
      WHERE id = ?
      `,
      [appointment.id]
    );

    return {
      action: "failed",
      synced: false,
      reason: "No active Google Calendar connection found"
    };
  }

  const oauth2Client = createOAuthClient();

  oauth2Client.setCredentials({
    access_token: connection.access_token,
    refresh_token: connection.refresh_token,
    expiry_date: connection.expiry_date
  });

  const calendar = google.calendar({
    version: "v3",
    auth: oauth2Client
  });

  const event = buildGoogleEventFromAppointment(appointment);

  const calendarId =
    appointment.google_calendar_id ||
    connection.calendar_id ||
    "primary";

  try {
    const response = await calendar.events.update({
      calendarId,
      eventId: appointment.google_event_id,
      requestBody: event
    });

    await db.query(
      `
      UPDATE appointments
      SET
        google_calendar_id = ?,
        google_event_id = ?,
        google_sync_status = 'synced',
        google_sync_error = NULL,
        google_synced_at = NOW()
      WHERE id = ?
      `,
      [
        calendarId,
        response.data.id || appointment.google_event_id,
        appointment.id
      ]
    );

    return {
      action: "updated",
      synced: true,
      google_event_id: response.data.id || appointment.google_event_id,
      htmlLink: response.data.htmlLink || null,
      calendarId
    };
  } catch (error) {
    await db.query(
      `
      UPDATE appointments
      SET
        google_sync_status = 'failed',
        google_sync_error = ?
      WHERE id = ?
      `,
      [error.message, appointment.id]
    );

    return {
      action: "failed",
      synced: false,
      reason: error.message
    };
  }
}

module.exports = {
  syncAppointmentToGoogleCalendar,
  updateGoogleCalendarEventForAppointment,
  cancelGoogleCalendarEventForAppointment
};