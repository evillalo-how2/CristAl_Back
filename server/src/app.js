const express = require("express");
const cors = require("cors");

const servicesRoutes = require("./routes/services.routes");
const usersRoutes = require("./routes/users.routes");
const patientsRoutes = require("./routes/patients.routes");
const appointmentsRoutes = require("./routes/appointments.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "CristAl backend is running"
  });
});

app.use("/api/services", servicesRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/patients", patientsRoutes);
app.use("/api/appointments", appointmentsRoutes);

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found"
  });
});

module.exports = app;