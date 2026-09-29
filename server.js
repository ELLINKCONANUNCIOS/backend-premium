const express = require("express");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const crypto = require("crypto");
const qs = require("qs");
require("dotenv").config();

const app = express();

// =========================
// CONFIGURACIÓN
// =========================

const FRONTEND_URL = "https://ellinkconanuncios.github.io";

const PORT = process.env.PORT || 3000;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;

const REDIRECT_URI =
    process.env.PATREON_REDIRECT_URI ||
    "https://backend-premium-production-29b1.up.railway.app/callback";

// IMPORTANTE:
// Pon aquí el ID de TU campaña de Patreon en Railway.
const PATREON_CAMPAIGN_ID = process.env.PATREON_CAMPAIGN_ID;

// =========================
// VALIDAR VARIABLES
// =========================

if (!CLIENT_ID) {
    console.error("Falta CLIENT_ID en las variables de Railway.");
}

if (!CLIENT_SECRET) {
    console.error("Falta CLIENT_SECRET en las variables de Railway.");
}

if (!PATREON_CAMPAIGN_ID) {
    console.error("Falta PATREON_CAMPAIGN_ID en las variables de Railway.");
}

// =========================
// MIDDLEWARES
// =========================

app.use(express.json());
app.use(cookieParser());

app.use(
    cors({
        origin: FRONTEND_URL,
        credentials: true
    })
);

app.options(
    "*",
    cors({
        origin: FRONTEND_URL,
        credentials: true
    })
);

// =========================
// RUTA RAÍZ
// =========================

app.get("/", (req, res) => {
    res.send("Backend VIP activo");
});

// =========================
// LOGIN CON PATREON
// =========================

app.get("/login", (req, res) => {
    try {
        // Crear estado aleatorio para proteger OAuth
        const state = crypto.randomBytes(32).toString("hex");

        // Guardar state temporalmente en cookie
        res.cookie("oauth_state", state, {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            path: "/",
            maxAge: 10 * 60 * 1000
        });

        const params = new URLSearchParams({
            response_type: "code",
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            scope: "identity identity.memberships",
            state
        });

        const url =
            "https://www.patreon.com/oauth2/authorize?" +
            params.toString();

        res.redirect(url);

    } catch (err) {
        console.error("ERROR LOGIN:", err);
        res.status(500).send("Error iniciando sesión con Patreon.");
    }
});

// =========================
// CALLBACK DE PATREON
// =========================

app.get("/callback", async (req, res) => {
    const code = req.query.code;
    const state = req.query.state;

    // Patreon puede devolver error
    if (req.query.error) {
        console.error(
            "Patreon OAuth error:",
            req.query.error,
            req.query.error_description || ""
        );

        return res.redirect(
            FRONTEND_URL + "/vip.html?login_error=true"
        );
    }

    // Verificar code
    if (!code) {
        return res.redirect(
            FRONTEND_URL + "/vip.html?login_error=true"
        );
    }

    // Verificar state
    const savedState = req.cookies.oauth_state;

    if (!state || !savedState || state !== savedState) {
        console.error("OAuth state inválido.");

        return res.status(403).send(
            "Error de seguridad: estado OAuth inválido."
        );
    }

    // Borrar state usado
    res.clearCookie("oauth_state", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/"
    });

    try {

        // =========================
        // 1. INTERCAMBIAR CODE
        // POR ACCESS TOKEN
        // =========================

        const tokenResponse = await axios.post(
            "https://www.patreon.com/api/oauth2/token",
            qs.stringify({
                grant_type: "authorization_code",
                code,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
                redirect_uri: REDIRECT_URI
            }),
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Accept": "application/json"
                }
            }
        );

        const accessToken = tokenResponse.data.access_token;

        if (!accessToken) {
            throw new Error("Patreon no devolvió access_token.");
        }

        // =========================
        // 2. OBTENER MEMBRESÍAS
        // =========================

        const userResponse = await axios.get(
            "https://www.patreon.com/api/oauth2/v2/identity",
            {
                params: {
                    include: "memberships",
                    "fields[member]":
                        "patron_status,currently_entitled_amount_cents"
                },
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/json"
                }
            }
        );

        const included = userResponse.data.included || [];

        // =========================
        // 3. BUSCAR MEMBRESÍA
        // DE TU CAMPAÑA
        // =========================

        const membership = included.find((member) => {

            if (member.type !== "member") {
                return false;
            }

            const campaignId =
                member.relationships?.campaign?.data?.id;

            return campaignId === PATREON_CAMPAIGN_ID;
        });

        // =========================
        // 4. VERIFICAR MEMBRESÍA ACTIVA
        // =========================

        const esVIP =
            membership &&
            membership.attributes?.patron_status === "active_patron";

        console.log(
            "Membresía encontrada:",
            membership ? membership.id : "NO"
        );

        console.log(
            "Estado Patreon:",
            membership?.attributes?.patron_status || "N/A"
        );

        // =========================
        // 5. NO ES VIP
        // =========================

        if (!esVIP) {

            // No guardamos token si no tiene acceso
            return res.redirect(
                FRONTEND_URL +
                "/vip.html?no_membresia=true"
            );
        }

        // =========================
        // 6. GUARDAR TOKEN
        // EN COOKIE SEGURA
        // =========================

        res.cookie("patreon_token", accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: "/",
            maxAge: 1000 * 60 * 60 * 24 * 30
        });

        // =========================
        // 7. REDIRIGIR AL VIP
        // =========================

        return res.redirect(
            FRONTEND_URL + "/vip.html"
        );

    } catch (err) {

        console.error(
            "ERROR CALLBACK:",
            err.response?.data || err.message || err
        );

        return res.redirect(
            FRONTEND_URL +
            "/vip.html?login_error=true"
        );
    }
});

// =========================
// FUNCIÓN PARA VERIFICAR VIP
// =========================

async function comprobarVIP(accessToken) {

    if (!accessToken) {
        return false;
    }

    try {

        const userResponse = await axios.get(
            "https://www.patreon.com/api/oauth2/v2/identity",
            {
                params: {
                    include: "memberships",
                    "fields[member]":
                        "patron_status,currently_entitled_amount_cents"
                },
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    Accept: "application/json"
                }
            }
        );

        const included = userResponse.data.included || [];

        const membership = included.find((member) => {

            if (member.type !== "member") {
                return false;
            }

            const campaignId =
                member.relationships?.campaign?.data?.id;

            return campaignId === PATREON_CAMPAIGN_ID;
        });

        return (
            !!membership &&
            membership.attributes?.patron_status === "active_patron"
        );

    } catch (err) {

        console.error(
            "Error comprobando Patreon:",
            err.response?.data || err.message
        );

        return false;
    }
}

// =========================
// COMPROBAR VIP
// =========================

app.get("/vip-check", async (req, res) => {

    const accessToken = req.cookies.patreon_token;

    if (!accessToken) {
        return res.json({
            vip: false
        });
    }

    const esVIP = await comprobarVIP(accessToken);

    if (!esVIP) {

        res.clearCookie("patreon_token", {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: "/"
        });

        return res.json({
            vip: false
        });
    }

    return res.json({
        vip: true
    });
});

// =========================
// LOGOUT
// =========================

app.get("/logout-vip", (req, res) => {

    res.clearCookie("patreon_token", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/"
    });

    res.redirect(
        FRONTEND_URL + "/vip.html"
    );
});

// =========================
// INICIAR SERVIDOR
// =========================

app.listen(PORT, () => {
    console.log(
        `Servidor VIP activo en el puerto ${PORT}`
    );
});
