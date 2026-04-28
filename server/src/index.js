const express = require('express');
const cors = require('cors');

const userRoutes = require('./routes/users');
const authRoutes = require('./routes/auth');
const db = require('./config/db');

const app = express();
const PORT = 3015;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        message: 'Servidor funcionando correctamente'
    });
});

app.use('/auth', authRoutes);
app.use('/users', userRoutes);

const testDBConnectionAndStart = async () => {
    try {
        await db.query('SELECT 1');
        console.log('La base de datos está funcionando');

        app.listen(PORT, () => {
            console.log(`Servidor corriendo en http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('Error con la base de datos:', error.message);
        process.exit(1);
    }
};

testDBConnectionAndStart();