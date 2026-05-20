const pool = require("../config/db");

const getActivePromotions = async (req, res, next) => {
  try {
    const [promotions] = await pool.query(
      `
      SELECT
        id,
        title,
        description,
        discount_type,
        discount_value,
        starts_at,
        ends_at
      FROM promotions
      WHERE is_active = 1
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (ends_at IS NULL OR ends_at >= NOW())
      ORDER BY created_at DESC
      `
    );

    return res.json({
      promotions
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getActivePromotions
};