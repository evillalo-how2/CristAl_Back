const getAllUsers = (req, res) => {
  res.json({ message: "Get all users" });
};

const getUserById = (req, res) => {
  res.json({ message: `Get user with id ${req.params.id}` });
};

const createUser = (req, res) => {
  res.status(201).json({ message: "Create user", data: req.body });
};

const updateUser = (req, res) => {
  res.json({ message: `Update user with id ${req.params.id}`, data: req.body });
};

const deleteUser = (req, res) => {
  res.json({ message: `Delete user with id ${req.params.id}` });
};

module.exports = {
  getAllUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser
};