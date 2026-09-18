require("dotenv").config();
const express = require("express");
const axios = require("axios");
const app = express();

// Variables seguras desde .env
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const CREATOR_ID = process.env.CREATOR_ID;
const PREMIUM_LINK = process.env.PREMIUM_LINK;

// Ruta para iniciar login con Patreon
app.get("/patreon-login", (req, res) => {
  const redirect = "https://www.patreon.com/oauth2/authorize" +
    `?response_type=code&client_id=${CLIENT_ID}` +
    `&redirect_uri=${process.env.REDIRECT_URI}` +
    "&scope=identity%20identity.memberships";

  res.redirect(redirect);
});

// Callback después del login
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  try {
    // Intercambiar el código por un token
    const tokenRes = await axios.post("https://www.patreon.com/api/oauth2/token", null, {
      params: {
        code,
        grant_type: "authorization_code",
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI
      }
    });

    const accessToken = tokenRes.data.access_token;

    // Obtener identidad + membresías
    const userRes = await axios.get(
      "https://www.patreon.com/api/oauth2/v2/identity?include=memberships",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const memberships = userRes.data.included || [];

    // Verificar si el usuario está suscrito a tu Patreon
    const esMiembro = memberships.some(m => m.relationships?.creator?.data?.id === CREATOR_ID);

    if (esMiembro) {
      return res.redirect(PREMIUM_LINK);
    } else {
      return res.send("Debes ser suscriptor para descargar sin anuncios.");
    }

  } catch (err) {
    console.error(err);
    res.send("Error verificando membresía.");
  }
});

// Puerto local
app.listen(3000, () => console.log("Servidor funcionando en puerto 3000"));
