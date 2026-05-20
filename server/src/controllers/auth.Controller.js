const db = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "1d"
    }
  );
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email y contraseña son obligatorios"
      });
    }

    const [rows] = await db.query(
      `
      SELECT 
        users.id,
        users.first_name,
        users.last_name,
        users.email,
        users.phone,
        users.password_hash,
        users.is_active,
        roles.name AS role
      FROM users
      INNER JOIN roles ON users.role_id = roles.id
      WHERE users.email = ?
      LIMIT 1
      `,
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        message: "Credenciales inválidas"
      });
    }

    const user = rows[0];

    if (!user.is_active) {
      return res.status(403).json({
        message: "La cuenta está desactivada"
      });
    }

    const passwordIsValid = await bcrypt.compare(password, user.password_hash);

    if (!passwordIsValid) {
      return res.status(401).json({
        message: "Credenciales inválidas"
      });
    }

    const token = generateToken(user);

    return res.json({
      message: "Inicio de sesión exitoso",
      token,
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

const registerPatient = async (req, res, next) => {
  const connection = await db.getConnection();

  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      password,
      birth_date = null,
      preferred_contact_channel = "whatsapp"
    } = req.body;

    if (!first_name || !last_name || !email || !phone || !password) {
      return res.status(400).json({
        message: "Nombre, apellido, email, teléfono y contraseña son obligatorios"
      });
    }

    await connection.beginTransaction();

    const [existingUsers] = await connection.query(
      `
      SELECT id 
      FROM users 
      WHERE email = ?
      LIMIT 1
      `,
      [email]
    );

    if (existingUsers.length > 0) {
      await connection.rollback();

      return res.status(409).json({
        message: "Ya existe una cuenta registrada con ese email"
      });
    }

    const [roles] = await connection.query(
      `
      SELECT id 
      FROM roles 
      WHERE name = 'patient'
      LIMIT 1
      `
    );

    if (roles.length === 0) {
      await connection.rollback();

      return res.status(500).json({
        message: "No existe el rol patient en la base de datos"
      });
    }

    const patientRoleId = roles[0].id;
    const passwordHash = await bcrypt.hash(password, 12);

    const [userResult] = await connection.query(
      `
      INSERT INTO users (
        role_id,
        first_name,
        last_name,
        email,
        phone,
        password_hash,
        is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, 1)
      `,
      [
        patientRoleId,
        first_name,
        last_name,
        email,
        phone,
        passwordHash
      ]
    );

    const userId = userResult.insertId;

    const [patientResult] = await connection.query(
      `
      INSERT INTO patients (
        user_id,
        first_name,
        last_name,
        phone,
        email,
        birth_date,
        preferred_contact_channel
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        userId,
        first_name,
        last_name,
        phone,
        email,
        birth_date,
        preferred_contact_channel
      ]
    );

    await connection.commit();

    return res.status(201).json({
      message: "Paciente registrado correctamente",
      user: {
        id: userId,
        first_name,
        last_name,
        email,
        role: "patient"
      },
      patient: {
        id: patientResult.insertId,
        user_id: userId
      }
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const getMe = async (req, res, next) => {
  try {
    const [rows] = await db.query(
      `
      SELECT 
        users.id,
        users.first_name,
        users.last_name,
        users.email,
        users.phone,
        users.is_active,
        roles.name AS role,
        patients.id AS patient_id
      FROM users
      INNER JOIN roles ON users.role_id = roles.id
      LEFT JOIN patients ON patients.user_id = users.id
      WHERE users.id = ?
      LIMIT 1
      `,
      [req.user.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        message: "Usuario no encontrado"
      });
    }

    return res.json({
      user: rows[0]
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  login,
  registerPatient,
  getMe
};