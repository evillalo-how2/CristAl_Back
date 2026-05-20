const { google } = require("googleapis");
const jwt = require("jsonwebtoken");

const GOOGLE_SCOPES = [
  process.env.GOOGLE_CALENDAR_SCOPE || "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email"
];

function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function createGoogleState(userId) {
  return jwt.sign(
    {
      userId,
      purpose: "google_calendar_connection"
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "10m"
    }
  );
}

function verifyGoogleState(state) {
  return jwt.verify(state, process.env.JWT_SECRET);
}

function getGoogleAuthUrl(userId) {
  const oauth2Client = createOAuthClient();
  const state = createGoogleState(userId);

  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GOOGLE_SCOPES,
    state
  });
}

module.exports = {
  createOAuthClient,
  getGoogleAuthUrl,
  verifyGoogleState,
  GOOGLE_SCOPES
};