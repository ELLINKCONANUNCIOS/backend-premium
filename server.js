require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const qs = require("qs");

const app = express();

// ⭐ NECESARIO PARA JSON Y COOKIES
app.use(express.json());
app.use(cookieParser());

// ⭐ ACTIVAR CORS PARA TU FRONTEND
app.use(cors({
  origin: "https://ellinkconanuncios.github.io",
  credentials: true
}));

// ⭐ RUTA LOGIN (Patreon OAuth2)
app.get("/login", (req, res) => {
  const redirect = `https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&scope=identity%20identity.memberships`;
  res.redirect(redirect);
});

// ⭐ CALLBACK (Patreon devuelve el código)
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("Error: falta el código");

  try {
    // ⭐ Intercambiar código por token (Patreon exige x-www-form-urlencoded)
    const tokenResponse = await axios.post(
      "https://www.patreon.com/api/oauth2/token",
      qs.stringify({
        grant_type: "authorization_code",
        code,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // ⭐ Verificar membresía real
    const userResponse = await axios.get(
      "https://www.patreon.com/api/oauth2/v2/identity?include=memberships",
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const memberships = userResponse.data.included;
    const isMember = memberships && memberships.length > 0;

    if (!isMember) {
      return res.status(403).send("✘ No eres VIP");
    }

    // ⭐ Crear cookie VIP cross-site
    res.cookie("vip", "true", {
      httpOnly: false,
      secure: true,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24 * 30
    });

    // ⭐ Redirigir a tu VIP.html
    res.redirect("https://ellinkconanuncios.github.io/vip.html");

  } catch (err) {
    console.error(err.response?.data || err);
    res.status(500).send("Error en callback");
  }
});

// ⭐ Verificar cookie VIP
app.get("/vip-check", (req, res) => {
  const vip = req.cookies.vip === "true";
  res.json({ vip });
});

// ⭐ Puerto dinámico para Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("VIP backend activo"));
