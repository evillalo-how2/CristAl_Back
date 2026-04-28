const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const app = require("./app");
const pool = require("./config/db");

const PORT = process.env.PORT || 3014;

async function startServer() {
  try {
    console.log("DB config loaded:");
    console.log({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      database: process.env.DB_NAME
    });

    const connection = await pool.getConnection();
    console.log("Database connected successfully");
    connection.release();

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Error starting server:");
    console.error(error);
    console.error("Error code:", error.code);
    console.error("Error errno:", error.errno);
    console.error("Error sqlMessage:", error.sqlMessage);
    console.error("Error stack:", error.stack);
    process.exit(1);
  }
}

startServer();