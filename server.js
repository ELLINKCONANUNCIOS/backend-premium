require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const qs = require("qs");

const app = express();

// ⭐ Middleware
app.use(express.json());
app.use(cookieParser());

// ⭐ CORS para GitHub Pages
app.use(cors({
  origin: "https://ellinkconanuncios.github.io",
  credentials: true
}));

// ⭐ LOGIN → Patreon OAuth2
app.get("/login", (req, res) => {
  const redirect = `https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&scope=identity%20identity.memberships`;
  res.redirect(redirect);
});

// ⭐ CALLBACK → Verificación de membresía
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("Error: falta el código");

  try {
    // ⭐ Intercambiar código por token
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
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      }
    );

    const accessToken = tokenResponse.data.access_token;

    // ⭐ Obtener membresía real
    const userResponse = await axios.get(
      "https://www.patreon.com/api/oauth2/v2/identity?include=memberships",
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const memberships = userResponse.data.included;

    // ⭐ VALIDACIÓN REAL (sin VIP falsos)
    const isMember =
      Array.isArray(memberships) &&
      memberships.length > 0 &&
      memberships.some(m => m.type === "member");

    if (!isMember) {
      // ❌ NO VIP → limpiar cookie
      res.clearCookie("vip", {
        httpOnly: false,
        secure: true,
        sameSite: "none"
      });

      return res.status(403).send("✘ No eres VIP");
    }

    // ⭐ SÍ VIP → crear cookie cross‑site
    res.cookie("vip", "true", {
      httpOnly: false,
      secure: true,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24 * 30 // 30 días
    });

    // ⭐ Redirigir a tu zona VIP
    res.redirect("https://ellinkconanuncios.github.io/vip.html");

  } catch (err) {
    console.error("ERROR CALLBACK:", err.response?.data || err);
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
