require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const app = express();

app.use(cookieParser());

// ⭐ 1. Ruta para iniciar sesión con Patreon
app.get("/patreon-login", (req, res) => {
  const redirect = `https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&scope=identity%20identity.memberships`;
  res.redirect(redirect);
});

// ⭐ 2. Callback de Patreon
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  try {
    // Obtener token
    const tokenResponse = await axios.post(
      "https://www.patreon.com/api/oauth2/token",
      {
        grant_type: "authorization_code",
        code: code,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Obtener membresía
    const userResponse = await axios.get(
      `https://www.patreon.com/api/oauth2/v2/identity?include=memberships`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      }
    );

    const memberships = userResponse.data.included;
    const isMember = memberships && memberships.length > 0;

    if (isMember) {
      // ⭐ Guardar cookie VIP
      res.cookie("vip", "true", {
        httpOnly: false,
        maxAge: 1000 * 60 * 60 * 24 * 30 // 30 días
      });

      // ⭐ Redirigir a tu página VIP (CORREGIDO)
      return res.redirect("https://ellinkconanuncios.github.io/vip.html");
    } else {
      return res.status(403).send("Debes ser suscriptor para acceder a la Zona VIP.");
    }
  } catch (error) {
    console.error(error);
    return res.status(500).send("Error en la autenticación.");
  }
});

// ⭐ 3. Ruta opcional para verificar cookie VIP
app.get("/vip-check", (req, res) => {
  if (req.cookies.vip === "true") {
    return res.json({ vip: true });
  } else {
    return res.json({ vip: false });
  }
});

app.listen(3000, () => console.log("Backend VIP listo"));
