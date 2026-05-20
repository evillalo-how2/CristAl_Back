const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const app = require("../src/app");

module.exports = app;