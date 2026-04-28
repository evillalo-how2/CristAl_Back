const getAllAppointments = (req, res) => {
  res.json({ message: "Get all appointments" });
};

const getAppointmentById = (req, res) => {
  res.json({ message: `Get appointment with id ${req.params.id}` });
};

const createAppointment = (req, res) => {
  res.status(201).json({ message: "Create appointment", data: req.body });
};

const updateAppointment = (req, res) => {
  res.json({ message: `Update appointment with id ${req.params.id}`, data: req.body });
};

const deleteAppointment = (req, res) => {
  res.json({ message: `Delete appointment with id ${req.params.id}` });
};

module.exports = {
  getAllAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  deleteAppointment
};