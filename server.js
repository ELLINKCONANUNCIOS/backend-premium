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
        "&redirect_uri=https://ellinkconanuncios.github.io/callback.html";

    res.redirect(url);
});

// =========================
// CALLBACK (GitHub Pages → Railway)
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
                redirect_uri: "https://ellinkconanuncios.github.io/callback.html"
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json"
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;

        // Guardar token en cookie
        res.cookie("patreon_token", accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: "/",
            maxAge: 1000 * 60 * 60 * 24 * 30
        });

        // 2. Obtener datos del usuario + membresías
        const userResponse = await axios.get(
            "https://www.patreon.com/api/oauth2/v2/identity?include=memberships",
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );

        const memberships = userResponse.data.included;

        // 3. Detectar VIP SOLO si patron_status === active_patron
        const esVIP = memberships && memberships.some(m =>
            m.type === "member" &&
            m.attributes.patron_status === "active_patron"
        );

        // 4. Si NO es VIP → borrar cookie y redirigir
        if (!esVIP) {
            res.clearCookie("vip", {
                httpOnly: false,
                secure: true,
                sameSite: "none",
                path: "/"
            });

            return res.redirect(
                "https://ellinkconanuncios.github.io/vip.html?no_membresia=true"
            );
        }

        // 5. Crear cookie VIP si está activo
        res.cookie("vip", "true", {
            httpOnly: false,
            secure: true,
            sameSite: "none",
            path: "/",
            maxAge: 1000 * 60 * 60 * 24 * 30
        });

        // 6. Redirigir a VIP.html
        res.redirect("https://ellinkconanuncios.github.io/vip.html");

    } catch (err) {
        console.error("ERROR CALLBACK:", err.response?.data || err);
        res.status(500).send("Error en callback");
    }
});

// =========================
// AUTO-VIP CHECK (VERIFICA PATREON EN CADA VISITA)
// =========================

app.get("/vip-check", async (req, res) => {
    try {
        const vipCookie = req.cookies.vip === "true";

        // Si no hay cookie → no es VIP
        if (!vipCookie) {
            return res.json({ vip: false });
        }

        // Si hay cookie → verificar en Patreon
        const accessToken = req.cookies.patreon_token;
        if (!accessToken) {
            return res.json({ vip: false });
        }

        const userResponse = await axios.get(
            "https://www.patreon.com/api/oauth2/v2/identity?include=memberships",
            {
                headers: { Authorization: `Bearer ${accessToken}` }
            }
        );

        const memberships = userResponse.data.included;

        const esVIP = memberships && memberships.some(m =>
            m.type === "member" &&
            m.attributes.patron_status === "active_patron"
        );

        if (!esVIP) {
            // borrar cookie VIP
            res.clearCookie("vip", {
                httpOnly: false,
                secure: true,
                sameSite: "none",
                path: "/"
            });

            return res.json({ vip: false });
        }

        // Si sigue activo
        res.json({ vip: true });

    } catch (err) {
        console.error("Error en vip-check:", err);
        res.json({ vip: false });
    }
});

// =========================
// LOGOUT VIP
// =========================

app.get("/logout-vip", (req, res) => {
    res.clearCookie("vip", {
        httpOnly: false,
        secure: true,
        sameSite: "none",
        path: "/"
    });

    res.clearCookie("patreon_token", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
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
