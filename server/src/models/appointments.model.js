const db = require("../config/db");
const { randomUUID } = require("crypto");

async function findAppointmentById(id) {
  const [rows] = await db.query(
    `
    SELECT
      id,
      public_id,
      patient_id,
      service_id,
      provider_user_id,
      appointment_date,
      start_time,
      end_time,
      status,
      source_channel,
      patient_message,
      internal_notes,
      created_by_user_id,
      created_at,
      updated_at
    FROM appointments
    WHERE id = ?
    LIMIT 1
    `,
    [id]
  );

  return rows[0] || null;
}

async function findPatientById(patientId) {
  const [rows] = await db.query(
    `
    SELECT
      id,
      user_id,
      first_name,
      last_name,
      phone,
      email,
      preferred_contact_channel,
      notes
    FROM patients
    WHERE id = ?
    LIMIT 1
    `,
    [patientId]
  );

  return rows[0] || null;
}

async function findPatientByPhoneOrEmail({ phone, email }) {
  if (email) {
    const [rows] = await db.query(
      `
      SELECT
        id,
        first_name,
        last_name,
        phone,
        email
      FROM patients
      WHERE phone = ?
         OR email = ?
      LIMIT 1
      `,
      [phone, email]
    );

    return rows[0] || null;
  }

  const [rows] = await db.query(
    `
    SELECT
      id,
      first_name,
      last_name,
      phone,
      email
    FROM patients
    WHERE phone = ?
    LIMIT 1
    `,
    [phone]
  );

  return rows[0] || null;
}

async function createPatientFromPublicForm(patientData) {
  const [result] = await db.query(
    `
    INSERT INTO patients (
      user_id,
      first_name,
      last_name,
      phone,
      email,
      preferred_contact_channel,
      notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      null,
      patientData.first_name,
      patientData.last_name,
      patientData.phone,
      patientData.email || null,
      patientData.preferred_contact_channel || "whatsapp",
      patientData.notes || null
    ]
  );

  return findPatientById(result.insertId);
}

async function findActiveServiceById(serviceId) {
  const [rows] = await db.query(
    `
    SELECT
      id,
      name,
      duration_minutes,
      is_active
    FROM services
    WHERE id = ?
      AND is_active = 1
    LIMIT 1
    `,
    [serviceId]
  );

  return rows[0] || null;
}

async function findServiceById(serviceId) {
  const [rows] = await db.query(
    `
    SELECT
      id,
      name,
      duration_minutes,
      is_active
    FROM services
    WHERE id = ?
      AND is_active = 1
    LIMIT 1
    `,
    [serviceId]
  );

  return rows[0] || null;
}

async function findProviderById(providerUserId) {
  const [rows] = await db.query(
    `
    SELECT 
      users.id,
      users.is_active,
      roles.name AS role
    FROM users
    INNER JOIN roles
      ON users.role_id = roles.id
    WHERE users.id = ?
      AND users.is_active = 1
      AND roles.name IN ('dentist', 'developer')
    LIMIT 1
    `,
    [providerUserId]
  );

  return rows[0] || null;
}

async function findProviderServiceAssignment(providerUserId, serviceId) {
  const [rows] = await db.query(
    `
    SELECT
      provider_user_id,
      service_id,
      is_active
    FROM provider_services
    WHERE provider_user_id = ?
      AND service_id = ?
      AND is_active = 1
    LIMIT 1
    `,
    [providerUserId, serviceId]
  );

  return rows[0] || null;
}

async function findOverlappingAppointment({
  provider_user_id,
  appointment_date,
  start_time,
  end_time
}) {
  const [rows] = await db.query(
    `
    SELECT id
    FROM appointments
    WHERE provider_user_id = ?
      AND appointment_date = ?
      AND status IN ('pending', 'confirmed')
      AND start_time < ?
      AND end_time > ?
    LIMIT 1
    `,
    [
      provider_user_id,
      appointment_date,
      end_time,
      start_time
    ]
  );

  return rows[0] || null;
}

async function findWorkingHourForAppointment({
  provider_user_id,
  appointment_date,
  start_time,
  end_time
}) {
  const [rows] = await db.query(
    `
    SELECT id
    FROM working_hours
    WHERE provider_user_id = ?
      AND weekday = WEEKDAY(?)
      AND is_available = 1
      AND start_time <= ?
      AND end_time >= ?
    LIMIT 1
    `,
    [
      provider_user_id,
      appointment_date,
      start_time,
      end_time
    ]
  );

  return rows[0] || null;
}

async function findCalendarBlockForAppointment({
  provider_user_id,
  appointment_date,
  start_time,
  end_time
}) {
  const [rows] = await db.query(
    `
    SELECT
      id,
      reason
    FROM calendar_blocks
    WHERE provider_user_id = ?
      AND block_date = ?
      AND (
        is_full_day = 1
        OR (
          start_time < ?
          AND end_time > ?
        )
      )
    LIMIT 1
    `,
    [
      provider_user_id,
      appointment_date,
      end_time,
      start_time
    ]
  );

  return rows[0] || null;
}

async function findWorkingHoursByProviderAndDate(providerUserId, date) {
  const [rows] = await db.query(
    `
    SELECT
      id,
      provider_user_id,
      weekday,
      start_time,
      end_time,
      is_available
    FROM working_hours
    WHERE provider_user_id = ?
      AND weekday = WEEKDAY(?)
      AND is_available = 1
    ORDER BY start_time
    `,
    [providerUserId, date]
  );

  return rows;
}

async function findAppointmentsByProviderAndDate(providerUserId, date) {
  const [rows] = await db.query(
    `
    SELECT
      id,
      start_time,
      end_time,
      status
    FROM appointments
    WHERE provider_user_id = ?
      AND appointment_date = ?
      AND status IN ('pending', 'confirmed')
    ORDER BY start_time
    `,
    [providerUserId, date]
  );

  return rows;
}

async function findCalendarBlocksByProviderAndDate(providerUserId, date) {
  const [rows] = await db.query(
    `
    SELECT
      id,
      block_date,
      start_time,
      end_time,
      is_full_day,
      reason
    FROM calendar_blocks
    WHERE provider_user_id = ?
      AND block_date = ?
    ORDER BY start_time
    `,
    [providerUserId, date]
  );

  return rows;
}

async function createAppointment(appointmentData) {
  const publicId = randomUUID();

  const [result] = await db.query(
    `
    INSERT INTO appointments (
      public_id,
      patient_id,
      service_id,
      provider_user_id,
      appointment_date,
      start_time,
      end_time,
      status,
      source_channel,
      patient_message,
      created_by_user_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      publicId,
      appointmentData.patient_id,
      appointmentData.service_id,
      appointmentData.provider_user_id,
      appointmentData.appointment_date,
      appointmentData.start_time,
      appointmentData.end_time,
      appointmentData.status || "pending",
      appointmentData.source_channel || "web_form",
      appointmentData.patient_message || null,
      appointmentData.created_by_user_id || null
    ]
  );

  return findAppointmentById(result.insertId);
}

async function findProvidersByServiceId(serviceId) {
  const [rows] = await db.query(
    `
    SELECT
      users.id,
      users.first_name,
      users.last_name,
      users.email
    FROM provider_services
    INNER JOIN users
      ON provider_services.provider_user_id = users.id
    INNER JOIN roles
      ON users.role_id = roles.id
    WHERE provider_services.service_id = ?
      AND provider_services.is_active = 1
      AND users.is_active = 1
      AND roles.name = 'dentist'
    ORDER BY users.first_name, users.last_name
    `,
    [serviceId]
  );

  return rows;
}

async function findAppointmentsForPanel({
  user,
  status,
  provider_user_id,
  service_id,
  patient_id,
  date,
  start_date,
  end_date,
  limit = 50,
  offset = 0
}) {
  const where = [];
  const values = [];

  if (user?.role === "dentist") {
    where.push("appointments.provider_user_id = ?");
    values.push(user.userId || user.id);
  } else if (provider_user_id) {
    where.push("appointments.provider_user_id = ?");
    values.push(provider_user_id);
  }

  if (status) {
    where.push("appointments.status = ?");
    values.push(status);
  }

  if (service_id) {
    where.push("appointments.service_id = ?");
    values.push(service_id);
  }

  if (patient_id) {
    where.push("appointments.patient_id = ?");
    values.push(patient_id);
  }

  if (date) {
    where.push("appointments.appointment_date = ?");
    values.push(date);
  }

  if (start_date) {
    where.push("appointments.appointment_date >= ?");
    values.push(start_date);
  }

  if (end_date) {
    where.push("appointments.appointment_date <= ?");
    values.push(end_date);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const safeLimit = Math.min(Number(limit) || 50, 100);
  const safeOffset = Number(offset) || 0;

  const [rows] = await db.query(
    `
    SELECT
      appointments.id,
      appointments.public_id,
      DATE_FORMAT(appointments.appointment_date, '%Y-%m-%d') AS appointment_date,
      appointments.start_time,
      appointments.end_time,
      appointments.status,
      appointments.source_channel,
      appointments.patient_message,
      appointments.internal_notes,
      appointments.google_sync_status,
      appointments.google_event_id,
      appointments.google_calendar_id,
      appointments.google_synced_at,
      appointments.created_at,
      appointments.updated_at,

      patients.id AS patient_id,
      patients.first_name AS patient_first_name,
      patients.last_name AS patient_last_name,
      patients.phone AS patient_phone,
      patients.email AS patient_email,

      services.id AS service_id,
      services.name AS service_name,
      services.duration_minutes AS service_duration_minutes,

      providers.id AS provider_user_id,
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
    ${whereClause}
    ORDER BY appointments.appointment_date DESC, appointments.start_time DESC
    LIMIT ?
    OFFSET ?
    `,
    [...values, safeLimit, safeOffset]
  );

  return rows;
}

async function findAppointmentDetailsById(id, user) {
  const where = ["appointments.id = ?"];
  const values = [id];

  if (user?.role === "dentist") {
    where.push("appointments.provider_user_id = ?");
    values.push(user.userId || user.id);
  }

  const [rows] = await db.query(
    `
    SELECT
      appointments.id,
      appointments.public_id,
      DATE_FORMAT(appointments.appointment_date, '%Y-%m-%d') AS appointment_date,
      appointments.start_time,
      appointments.end_time,
      appointments.status,
      appointments.source_channel,
      appointments.patient_message,
      appointments.internal_notes,
      appointments.google_sync_status,
      appointments.google_event_id,
      appointments.google_calendar_id,
      appointments.google_synced_at,
      appointments.created_at,
      appointments.updated_at,

      patients.id AS patient_id,
      patients.first_name AS patient_first_name,
      patients.last_name AS patient_last_name,
      patients.phone AS patient_phone,
      patients.email AS patient_email,

      services.id AS service_id,
      services.name AS service_name,
      services.duration_minutes AS service_duration_minutes,

      providers.id AS provider_user_id,
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
    WHERE ${where.join(" AND ")}
    LIMIT 1
    `,
    values
  );

  return rows[0] || null;
}

async function findAppointmentForStatusUpdate(id, user) {
  const where = ["appointments.id = ?"];
  const values = [id];

  if (user?.role === "dentist") {
    where.push("appointments.provider_user_id = ?");
    values.push(user.userId || user.id);
  }

  const [rows] = await db.query(
    `
    SELECT
      appointments.id,
      appointments.status,
      appointments.provider_user_id,
      appointments.google_event_id,
      appointments.google_calendar_id,
      appointments.google_sync_status
    FROM appointments
    WHERE ${where.join(" AND ")}
    LIMIT 1
    `,
    values
  );

  return rows[0] || null;
}

async function updateAppointmentStatusById({
  appointmentId,
  status,
  internal_notes = null,
  user
}) {
  const appointment = await findAppointmentForStatusUpdate(appointmentId, user);

  if (!appointment) {
    return null;
  }

  const fields = [
    "status = ?",
    "updated_at = NOW()"
  ];

  const values = [status];

  if (internal_notes !== null && internal_notes !== undefined) {
    fields.push("internal_notes = ?");
    values.push(internal_notes);
  }

  values.push(appointmentId);

  await db.query(
    `
    UPDATE appointments
    SET ${fields.join(", ")}
    WHERE id = ?
    `,
    values
  );

  return findAppointmentDetailsById(appointmentId, user);
}

async function findAppointmentForReschedule(id, user) {
  const where = ["appointments.id = ?"];
  const values = [id];

  if (user?.role === "dentist") {
    where.push("appointments.provider_user_id = ?");
    values.push(user.userId || user.id);
  }

  const [rows] = await db.query(
    `
    SELECT
      appointments.id,
      appointments.status,
      appointments.service_id,
      appointments.provider_user_id,
      appointments.appointment_date,
      appointments.start_time,
      appointments.end_time,
      appointments.google_event_id,
      appointments.google_calendar_id,
      appointments.google_sync_status
    FROM appointments
    WHERE ${where.join(" AND ")}
    LIMIT 1
    `,
    values
  );

  return rows[0] || null;
}

async function findOverlappingAppointmentForReschedule({
  appointment_id,
  provider_user_id,
  appointment_date,
  start_time,
  end_time
}) {
  const [rows] = await db.query(
    `
    SELECT id
    FROM appointments
    WHERE id <> ?
      AND provider_user_id = ?
      AND appointment_date = ?
      AND status IN ('pending', 'confirmed')
      AND start_time < ?
      AND end_time > ?
    LIMIT 1
    `,
    [
      appointment_id,
      provider_user_id,
      appointment_date,
      end_time,
      start_time
    ]
  );

  return rows[0] || null;
}

async function updateAppointmentScheduleById({
  appointmentId,
  provider_user_id,
  appointment_date,
  start_time,
  end_time,
  internal_notes = null,
  user
}) {
  const fields = [
    "provider_user_id = ?",
    "appointment_date = ?",
    "start_time = ?",
    "end_time = ?",
    "updated_at = NOW()"
  ];

  const values = [
    provider_user_id,
    appointment_date,
    start_time,
    end_time
  ];

  if (internal_notes !== null && internal_notes !== undefined) {
    fields.push("internal_notes = ?");
    values.push(internal_notes);
  }

  values.push(appointmentId);

  await db.query(
    `
    UPDATE appointments
    SET ${fields.join(", ")}
    WHERE id = ?
    `,
    values
  );

  return findAppointmentDetailsById(appointmentId, user);
}

module.exports = {
  findAppointmentById,
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
  createAppointment,
  findProvidersByServiceId,
  findAppointmentsForPanel,
  findAppointmentDetailsById,
  findAppointmentForStatusUpdate,
  findAppointmentForReschedule,
  findOverlappingAppointmentForReschedule,
  updateAppointmentScheduleById,
  updateAppointmentStatusById

};