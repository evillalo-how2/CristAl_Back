const express = require("express");
const cors = require("cors");

const servicesRoutes = require("./routes/services.routes");
const usersRoutes = require("./routes/users.routes");
const patientsRoutes = require("./routes/patients.routes");
const appointmentsRoutes = require("./routes/appointments.routes");
const authRoutes = require("./routes/auth.routes");
const promotionsRoutes = require("./routes/promotions.routes");
const googleRoutes = require("./routes/google.routes");

const app = express();

function getAllowedOrigins() {
  const defaultOrigins = [
    "http://localhost:5173",
    "http://localhost:5174"
  ];

  const envOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
    : [];

  return [...defaultOrigins, ...envOrigins];
}

const corsOptions = {
  origin(origin, callback) {
    const allowedOrigins = getAllowedOrigins();

    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "CristAl backend is running"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/services", servicesRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/patients", patientsRoutes);
app.use("/api/appointments", appointmentsRoutes);
app.use("/api/promotions", promotionsRoutes);
app.use("/api/google", googleRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found"
  });
});

module.exports = app;