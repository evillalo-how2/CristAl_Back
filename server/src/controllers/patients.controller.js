const getAllPatients = (req, res) => {
  res.json({ message: "Get all patients" });
};

const getPatientById = (req, res) => {
  res.json({ message: `Get patient with id ${req.params.id}` });
};

const createPatient = (req, res) => {
  res.status(201).json({ message: "Create patient", data: req.body });
};

const updatePatient = (req, res) => {
  res.json({ message: `Update patient with id ${req.params.id}`, data: req.body });
};

const deletePatient = (req, res) => {
  res.json({ message: `Delete patient with id ${req.params.id}` });
};

module.exports = {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient
};