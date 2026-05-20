const { google } = require("googleapis");
const db = require("../config/db");

const {
  syncAppointmentToGoogleCalendar
} = require("../services/googleCalendar.service");

const {
  createOAuthClient,
  getGoogleAuthUrl,
  verifyGoogleState
} = require("../config/google");

const startGoogleAuth = (req, res) => {
  const authUrl = getGoogleAuthUrl(req.user.userId);

  return res.json({
    message: "Google authorization URL generated",
    url: authUrl
  });
};

const handleGoogleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;

    if (!code) {
      return res.status(400).json({
        message: "Authorization code is required"
      });
    }

    if (!state) {
      return res.status(400).json({
        message: "State is required"
      });
    }

    const decodedState = verifyGoogleState(state);

    if (decodedState.purpose !== "google_calendar_connection") {
      return res.status(400).json({
        message: "Invalid state purpose"
      });
    }

    const userId = decodedState.userId;

    const oauth2Client = createOAuthClient();

    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.access_token) {
      return res.status(400).json({
        message: "Google did not return an access token"
      });
    }

    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({
      auth: oauth2Client,
      version: "v2"
    });

    const { data: googleProfile } = await oauth2.userinfo.get();

    await db.query(
      `
      INSERT INTO google_calendar_connections (
        user_id,
        google_email,
        calendar_id,
        access_token,
        refresh_token,
        expiry_date,
        is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, 1)
      ON DUPLICATE KEY UPDATE
        google_email = VALUES(google_email),
        calendar_id = VALUES(calendar_id),
        access_token = VALUES(access_token),
        refresh_token = IFNULL(VALUES(refresh_token), refresh_token),
        expiry_date = VALUES(expiry_date),
        is_active = 1
      `,
      [
        userId,
        googleProfile.email,
        "primary",
        tokens.access_token,
        tokens.refresh_token || null,
        tokens.expiry_date || null
      ]
    );

    return res.json({
      message: "Google Calendar conectado correctamente",
      google_email: googleProfile.email
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error connecting Google Calendar",
      error: error.message
    });
  }
};

module.exports = {
  startGoogleAuth,
  handleGoogleCallback
};