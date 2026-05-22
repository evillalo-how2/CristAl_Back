const pool = require("../config/db");

async function findAllServices() {
  const [rows] = await pool.execute(
    `SELECT
      id,
      name,
      slug,
      short_description,
      duration_minutes,
      price_from,
      price_to,
      is_active,
      created_at,
      updated_at
    FROM services
    WHERE is_active=1
    ORDER BY id ASC`
  );

  return rows;
}

async function findServiceById(id) {
  const [rows] = await pool.execute(
    `SELECT
      id,
      name,
      slug,
      short_description,
      duration_minutes,
      price_from,
      price_to,
      is_active,
      created_at,
      updated_at
    FROM services
    WHERE id = ?`,
    [id]
  );

  return rows[0] || null;
}

async function findServiceBySlug(slug) {
  const [rows] = await pool.execute(
    `SELECT
      id,
      name,
      slug,
      short_description,
      duration_minutes,
      price_from,
      price_to,
      is_active,
      created_at,
      updated_at
    FROM services
    WHERE slug = ?`,
    [slug]
  );

  return rows[0] || null;
}

async function createService(serviceData) {
  const [result] = await pool.execute(
    `INSERT INTO services (
      name,
      slug,
      short_description,
      duration_minutes,
      price_from,
      price_to,
      is_active
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      serviceData.name,
      serviceData.slug,
      serviceData.short_description,
      serviceData.duration_minutes,
      serviceData.price_from,
      serviceData.price_to,
      serviceData.is_active
    ]
  );

  return findServiceById(result.insertId);
}

async function updateService(id, serviceData) {
  await pool.execute(
    `UPDATE services
    SET
      name = ?,
      slug = ?,
      short_description = ?,
      duration_minutes = ?,
      price_from = ?,
      price_to = ?,
      is_active = ?
    WHERE id = ?`,
    [
      serviceData.name,
      serviceData.slug,
      serviceData.short_description,
      serviceData.duration_minutes,
      serviceData.price_from,
      serviceData.price_to,
      serviceData.is_active,
      id
    ]
  );

  return findServiceById(id);
}

async function deleteService(id) {
  const [result] = await pool.execute(
    `DELETE FROM services WHERE id = ?`,
    [id]
  );

  return result.affectedRows > 0;
}

module.exports = {
  findAllServices,
  findServiceById,
  findServiceBySlug,
  createService,
  updateService,
  deleteService
};