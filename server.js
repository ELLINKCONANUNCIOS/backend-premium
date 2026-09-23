const express = require("express");
const axios = require("axios");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();

// ⭐ CORS para permitir comunicación con GitHub Pages
app.use(cors({
  origin: "https://ellinkconanuncios.github.io",
  credentials: true
}));

// ⭐ Middleware para cookies
app.use(cookieParser());

// ⚠️ Variables de entorno (NO pongas claves aquí)
const CLIENT_ID = process.env.PATREON_CLIENT_ID;
const CLIENT_SECRET = process.env.PATREON_CLIENT_SECRET;

// ⭐ URL de callback en Railway
const REDIRECT_URI = "https://backend-premium-production-29b1.up.railway.app/callback";

// ⭐ Ruta para verificar VIP
app.get("/vip-check", (req, res) => {
  const tieneVIP = req.cookies.vip === "true";
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

  if (!code) {
    return res.send(`
      <script>
        alert("No se recibió el código de autorización.");
        window.location.href = "https://ellinkconanuncios.github.io/vip.html";
      </script>
    `);
  }

  try {
    // ⭐ Intercambiar código por token
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

    // ⭐ Obtener identidad + membresías
    const userRes = await axios.get(
      "https://www.patreon.com/api/oauth2/v2/identity?include=memberships",
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    const memberships = userRes.data.included;
    const esVIP = memberships && memberships.length > 0;

    if (esVIP) {
      // ⭐ Crear cookie VIP cross-site
      res.cookie("vip", "true", {
        httpOnly: false,
        secure: true,
        sameSite: "None",
        path: "/"
      });

      // ⭐ Redirigir a tu página VIP en GitHub Pages
      res.redirect("https://ellinkconanuncios.github.io/vip.html");
    } else {
      res.send(`
        <script>
          alert("No tienes una membresía activa en Patreon.");
          window.location.href = "https://ellinkconanuncios.github.io/vip.html";
        </script>
      `);
    }
  } catch (err) {
    console.error(err);
    res.send(`
      <script>
        alert("Error al verificar tu cuenta de Patreon.");
        window.location.href = "https://ellinkconanuncios.github.io/vip.html";
      </script>
    `);
  }
});

// ⭐ Puerto dinámico para Railway
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log("Backend Patreon activo en puerto " + PORT);
});
