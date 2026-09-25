require("dotenv").config();
const express = require("express");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const qs = require("qs");

const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());

// CORS para tu GitHub Pages
app.use(cors({
  origin: "https://ellinkconanuncios.github.io",
  credentials: true
}));

// ⭐ LOGIN → Patreon OAuth2
app.get("/login", (req, res) => {
  const redirect = `https://www.patreon.com/oauth2/authorize?response_type=code&client_id=${process.env.CLIENT_ID}&redirect_uri=${process.env.REDIRECT_URI}&scope=identity%20identity.memberships`;
  res.redirect(redirect);
});

// ⭐ CALLBACK → Verificar membresía real
app.get("/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send("Error: falta el código");

  try {
    // ⭐ Obtener token
    const tokenResponse = await axios.post(
      "https://www.patreon.com/api/oauth2/token",
      qs.stringify({
        grant_type: "authorization_code",
        code,
        client_id: process.env.CLIENT_ID,
        client_secret: process.env.CLIENT_SECRET,
        redirect_uri: process.env.REDIRECT_URI
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenResponse.data.access_token;

    // ⭐ Obtener usuario + membresías
    const userResponse = await axios.get(
      "https://www.patreon.com/api/oauth2/v2/identity?include=memberships",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const memberships = userResponse.data.included;

    // ⭐ VALIDACIÓN REAL DE VIP (sin VIP falsos)
    const isMember =
      Array.isArray(memberships) &&
      memberships.length > 0 &&
      memberships.some(m => m.type === "membership");

    if (!isMember) {
      // ❌ NO VIP → limpiar cookie y mostrar mensaje
      res.clearCookie("vip", {
        httpOnly: false,
        secure: true,
        sameSite: "none"
      });

      return res.redirect("https://ellinkconanuncios.github.io/vip.html?no_membresia=true");
    }

    // ⭐ SÍ VIP → crear cookie
    res.cookie("vip", "true", {
      httpOnly: false,
      secure: true,
      sameSite: "none",
      maxAge: 1000 * 60 * 60 * 24 * 30 // 30 días
    });

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

// ⭐ Cerrar sesión VIP
app.get("/logout-vip", (req, res) => {
  res.clearCookie("vip", {
    httpOnly: false,
    secure: true,
    sameSite: "none"
  });

  res.redirect("https://ellinkconanuncios.github.io/vip.html");
});

// ⭐ Puerto dinámico para Railway
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("VIP backend activo en puerto", PORT));
