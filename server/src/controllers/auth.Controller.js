const db = require("../config/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const register = async (req, res) => {
    try {
        const { nombre, email, password } = req.body;

        if (!nombre || !email || !password) {
            return res.status(400).json({
                error: "Nombre, email y password son obligatorios"
            });
        }

        const [existingUser] = await db.query(
            "SELECT * FROM usuarios WHERE email = ?",
            [email]
        );

        if (existingUser.length > 0) {
            return res.status(409).json({
                error: "El email ya está registrado"
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const [result] = await db.query(
            "INSERT INTO usuarios (nombre, email, password_hash) VALUES (?, ?, ?)",
            [nombre, email, passwordHash]
        );

        return res.status(201).json({
            message: "Usuario registrado correctamente",
            user: {
                id: result.insertId,
                nombre,
                email
            }
        });

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: "Error al registrar usuario"
        });
    }
};


const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                error: 'Email y password son obligatorios'
            });
        }

        const [users] = await db.query(
            'SELECT * FROM usuarios WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({
                error: 'Credenciales incorrectas'
            });
        }


    const user = users[0];

    const passwordOk = await bcrypt.compare(password, user.password_hash);

    if (!passwordOk) {
        return res.status(401).json({
            error: 'Credenciales incorrectas'
        });
    }

    const token = jwt.sign(
        {
            id: user.id,
            email: user.email
        },
        process.env.JWT_SECRET,
        {
            expiresIn: '1h'
        }
    );
    res.json({
    message: 'Login correcto',
    token,
    user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email
    }
});

} catch (error) {
    console.error(error);

    res.status(500).json({
        error: 'Error al iniciar sesión'
    });
}
};

module.exports = {
    register,
    login
};