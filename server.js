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
    // ⭐ Intercambiar código por token
    const tokenResponse = await axios.post("https://www.patreon.com/api/oauth2/token", null, {
      params: {
        grant_type: "authorization_code",
        code,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI
      }
    });

    const accessToken = tokenResponse.data.access_token;

    // ⭐ Obtener datos del usuario
    const userResponse = await axios.get("https://www.patreon.com/api/oauth2/v2/identity?include=memberships", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const memberships = userResponse.data.included;

    // ⭐ Verificar si es VIP
    const esVIP = memberships && memberships.length > 0;

    if (esVIP) {
      // ⭐ Crear cookie VIP compatible con Railway
      res.cookie("vip", "true", {
        httpOnly: false,
        secure: true,
        sameSite: "None",
        maxAge: 1000 * 60 * 60 * 24 * 30
      });

      return res.redirect("https://ellinkconanuncios.github.io/vip.html");
    }

    return res.send("No tienes membresía VIP.");
  } catch (error) {
    console.error("Error en callback:", error);
    res.send("Error en la autenticación.");
  }
});

// ⭐ 3. Verificar cookie VIP
app.get("/vip-check", (req, res) => {
  if (req.cookies.vip === "true") {
    return res.json({ vip: true });
  } else {
    return res.json({ vip: false });
  }
});

// ⭐ 4. Puerto para Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Backend VIP listo en el puerto " + PORT));
