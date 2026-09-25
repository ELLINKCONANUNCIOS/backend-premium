import express from "express";
import axios from "axios";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// =========================
// MIDDLEWARES
// =========================

app.use(express.json());
app.use(cookieParser());

// CORS para GitHub Pages
app.use(
    cors({
        origin: "https://ellinkconanuncios.github.io",
        credentials: true
    })
);

// Permitir cookies cross-site
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    next();
});

// Preflight OPTIONS
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
// CALLBACK UNIVERSAL (FUNCIONA PARA VIP REGALADO)
// =========================

app.get("/callback", async (req, res) => {
    const code = req.query.code;
    if (!code) return res.send("Error: falta el código");

    try {
        // 1. Intercambiar el código por el access_token
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

        // 2. Obtener datos del usuario + membresías (UNIVERSAL)
        const userResponse = await axios.get(
            "https://www.patreon.com/api/oauth2/v2/identity" +
            "?include=memberships" +
            "&fields[member]=patron_status",
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );

        // 3. Extraer membresías
        const memberships = userResponse.data.included;

        // 4. Detectar si tiene membresía activa
        const tieneNivel = memberships && memberships.length > 0;

        if (!tieneNivel) {
            return res.redirect(
                "https://ellinkconanuncios.github.io/vip.html?no_membresia=true"
            );
        }

        // 5. Crear cookie VIP compatible con GitHub Pages
        res.cookie("vip", "true", {
            httpOnly: false,
            secure: true,
            sameSite: "none",
            maxAge: 1000 * 60 * 60 * 24 * 30 // 30 días
        });

        // 6. Redirigir a tu VIP.html
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
// INICIAR SERVIDOR
// =========================

app.listen(3000, () => {
    console.log("Servidor VIP activo en el puerto 3000");
});
