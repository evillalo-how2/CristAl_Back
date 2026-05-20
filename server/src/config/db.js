const mysql = require("mysql2/promise");
const path = require("path");
const fs = require("fs");

require("dotenv").config({
  path: path.resolve(__dirname, "../../.env"),
});

function buildSslConfig() {
  if (process.env.DB_SSL !== "true") {
    return undefined;
  }

  const rejectUnauthorized =
    process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false";

  if (process.env.DB_CA_CERT) {
    return {
      ca: process.env.DB_CA_CERT.replace(/\\n/g, "\n"),
      rejectUnauthorized,
    };
  }

  if (process.env.DB_CA_CERT_PATH) {
    const caPath = path.resolve(
      __dirname,
      "../../",
      process.env.DB_CA_CERT_PATH
    );

    return {
      ca: fs.readFileSync(caPath, "utf8"),
      rejectUnauthorized,
    };
  }

  return {
    rejectUnauthorized,
  };
}

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
  queueLimit: 0,
  ssl: buildSslConfig(),
});

module.exports = pool;