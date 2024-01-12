// import config.json
import config from "./config.json" assert { type: "json" };
// const { OAuth2Client } = require("google-auth-library");
import { OAuth2Client } from "google-auth-library";
const client = new OAuth2Client();

async function verifyUser(token) {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: config.google_client_id,
    });
    const payload = ticket.getPayload();
  // returns the user id, email, display name, and photo url
    const googleId = payload["sub"];
    const email = payload["email"];
    const name = payload["name"];
    const photoUrl = payload["picture"];
    return { googleId, email, name, photoUrl };
}

export { verifyUser };