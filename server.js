const express = require("express");
const axios = require("axios");
const cors = require("cors");
const app = express();

// ⭐ CORS para permitir comunicación con GitHub Pages
app.use(cors({
  origin: "https://ellinkconanuncios.github.io",
  credentials: true
}));

// ⚠️ NO ESCRIBAS LAS CLAVES AQUÍ
const CLIENT_ID = process.env.PATREON_CLIENT_ID;
const CLIENT_SECRET = process.env.PATREON_CLIENT_SECRET;
const REDIRECT_URI = "https://backend-premium-production-29b1.up.railway.app/callback";

// ⭐ Ruta para verificar VIP
app.get("/vip-check", (req, res) => {
  const tieneVIP = req.headers.cookie && req.headers.cookie.includes("vip=true");
  res.json({ vip: tieneVIP });
});

// ⭐ Login con Patreon
app.get("/login", (req, res) => {
  const url =
    "https://www.patreon.com/oauth2/authorize" +
    "?response_type=code" +
    `&client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    "&scope=identity%20identity.memberships";
  res.redirect(url);
});

// ⭐ Callback de Patreon
app.get("/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const tokenRes = await axios.post(
      "https://www.patreon.com/api/oauth2/token",
      null,
      {
        params: {
          grant_type: "authorization_code",
          code,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI
        }
      }
    );

    const access_token = tokenRes.data.access_token;

    const userRes = await axios.get(
      "https://www.patreon.com/api/oauth2/v2/identity?include=memberships",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const memberships = userRes.data.included;
    const esVIP = memberships && memberships.length > 0;

    if (esVIP) {
      res.send(`
        <script>
          document.cookie = "vip=true; path=/";
          window.location.href = "/vip.html";
        </script>
      `);
    } else {
      res.send(`
        <script>
          alert("No tienes una membresía activa en Patreon.");
          window.location.href = "/vip.html";
        </script>
      `);
    }
  } catch (err) {
    console.error(err);
    res.send(`
      <script>
        alert("Error al verificar tu cuenta de Patreon.");
        window.location.href = "/vip.html";
      </script>
    `);
  }
});

// ⭐ Puerto dinámico para Railway
const PORT = process.env.PORT || 3000;

if (!process.env.PORT) {
  console.log("⚠️ Railway NO envió PORT. Usando 3000.");
}

app.listen(PORT, "0.0.0.0", () => {
  console.log("Backend Patreon activo en puerto " + PORT);
});
