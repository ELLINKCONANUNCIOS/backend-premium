require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cookieParser = require("cookie-parser");

const app = express();
app.use(cookieParser());

// Puerto compatible con Railway
const PORT = process.env.PORT || 3000;

// ⭐ 1. Ruta para iniciar sesión con Patreon
app.get("/login", (req, res) => {
  const redirect = `https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&scope=identity%20identity.memberships`;
  res.redirect(redirect);
});

// ⭐ 2. Callback de Patreon
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("Error: falta el código de autorización.");
  }

  try {
    // Intercambiar código por token
    const tokenResponse = await axios.post(
      "https://www.patreon.com/api/oauth2/token",
      {
        grant_type: "authorization_code",
        code,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // Obtener membresía del usuario
    const userResponse = await axios.get(
      "https://www.patreon.com/api/oauth2/v2/identity?include=memberships",
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

      // ⭐ Redirigir a tu página VIP
      return res.redirect("https://ellinkconanuncios.github.io/vip.html");
    } else {
      return res.status(403).send("✖ No eres VIP — suscríbete para acceder.");
    }
  } catch (error) {
    console.error("Error en /callback:", error.response?.data || error);
    return res.status(500).send("Error en la autenticación con Patreon.");
  }
});

// ⭐ 3. Ruta para verificar cookie VIP
app.get("/vip-check", (req, res) => {
  const vip = req.cookies.vip === "true";
  res.json({ vip });
});

// ⭐ Iniciar servidor
app.listen(PORT, () => {
  console.log(`Backend VIP activo en el puerto ${PORT}`);
});
