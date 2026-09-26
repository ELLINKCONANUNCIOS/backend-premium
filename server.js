const express = require("express");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const qs = require("qs");
require("dotenv").config();

const app = express();

// =========================
// MIDDLEWARES
// =========================

app.use(express.json());
app.use(cookieParser());

app.use(
    cors({
        origin: "https://ellinkconanuncios.github.io",
        credentials: true
    })
);

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Origin", "https://ellinkconanuncios.github.io");
    next();
});

app.options("*", cors());

// =========================
// RUTA RAÍZ
// =========================

app.get("/", (req, res) => {
    res.send("Backend VIP activo");
});

// =========================
// LOGIN → REDIRIGE A PATREON
// =========================

app.get("/login", (req, res) => {
    const url =
        "https://www.patreon.com/oauth2/authorize" +
        "?response_type=code" +
        "&client_id=" + process.env.CLIENT_ID +
        "&redirect_uri=" + process.env.REDIRECT_URI;

    res.redirect(url);
});

// =========================
// CALLBACK UNIVERSAL (VIP NORMAL + VIP REGALADO)
// =========================

app.get("/callback", async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send("Error: falta el código");

    try {
        // 1. Intercambiar el código por el access_token
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
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json"
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;

        // 2. Obtener datos del usuario + membresías
        const userResponse = await axios.get(
            "https://www.patreon.com/api/oauth2/v2/identity?include=memberships",
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );

        // 3. Detectar si existe un "member" (VIP normal o regalado)
        const memberships = userResponse.data.included;
        const esVIP = memberships && memberships.some(m => m.type === "member");

        if (!esVIP) {
            return res.redirect(
                "https://ellinkconanuncios.github.io/vip.html?no_membresia=true"
            );
        }

        // 4. Crear cookie VIP
        res.cookie("vip", "true", {
            httpOnly: false,
            secure: true,
            sameSite: "none",
            domain: "backend-premium-production-29b1.up.railway.app",
            path: "/",
            maxAge: 1000 * 60 * 60 * 24 * 30
        });

        // 5. Redirigir a VIP.html
        res.redirect("https://ellinkconanuncios.github.io/vip.html");

    } catch (err) {
        console.error("ERROR CALLBACK:", err.response?.data || err);
        res.status(500).send("Error en callback");
    }
});

// =========================
// VIP-CHECK
// =========================

app.get("/vip-check", (req, res) => {
    try {
        const vip = req.cookies.vip === "true";
        res.json({ vip });
    } catch (err) {
        console.error("Error en vip-check:", err);
        res.json({ vip: false });
    }
});

// =========================
// LOGOUT VIP (CORREGIDO)
// =========================

app.get("/logout-vip", (req, res) => {
    res.clearCookie("vip", {
        httpOnly: false,
        secure: true,
        sameSite: "none",
        domain: "backend-premium-production-29b1.up.railway.app",
        path: "/"
    });

    res.redirect("https://ellinkconanuncios.github.io/vip.html");
});

// =========================
// INICIAR SERVIDOR
// =========================

const PORT = process.env.PORT;

app.listen(PORT, () => {
    console.log("Servidor VIP activo en el puerto " + PORT);
});
