const express = require("express");
const router = express.Router();

const usersController = require("../controllers/users.controller");

const {
  authenticateToken
} = require("../middlewares/auth.middleware");

const {
  authorizeRoles
} = require("../middlewares/roles.middleware");

router.use(authenticateToken);
router.use(authorizeRoles("developer"));

router.get("/", usersController.getAllUsers);
router.get("/:id", usersController.getUserById);
router.post("/", usersController.createUser);
router.put("/:id", usersController.updateUser);
router.delete("/:id", usersController.deleteUser);

module.exports = router;