const express = require("express");
const axios = require("axios");
const app = express();

// ⚠️ NO ESCRIBAS LAS CLAVES AQUÍ
// Usa variables de entorno en Railway/Render/Replit
const CLIENT_ID = process.env.PATREON_CLIENT_ID;
const CLIENT_SECRET = process.env.PATREON_CLIENT_SECRET;
const REDIRECT_URI = "https://backend-premium-production-29b1.up.railway.app/callback"; // cámbialo por tu URL real

app.get("/login", (req, res) => {
  const url =
    "https://www.patreon.com/oauth2/authorize" +
    "?response_type=code" +
    `&client_id=${CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    "&scope=identity%20identity.memberships";
  res.redirect(url);
});

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
      // crea cookie VIP y redirige a tu página
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Backend Patreon activo en puerto " + PORT));
