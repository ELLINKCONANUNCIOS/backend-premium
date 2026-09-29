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

// Nombre público de tu campaña/página de Patreon
const PATREON_CAMPAIGN_VANITY = "ELLINKCONANUNCIOS";

// =========================
// VALIDAR VARIABLES
// =========================

if (!CLIENT_ID) {
    console.error("Falta CLIENT_ID en Railway.");
}

if (!CLIENT_SECRET) {
    console.error("Falta CLIENT_SECRET en Railway.");
}

if (!process.env.PATREON_REDIRECT_URI) {
    console.warn(
        "PATREON_REDIRECT_URI no está configurada. Se utilizará la URL predeterminada."
    );
}

// =========================
// MIDDLEWARES
// =========================

app.use(express.json());
app.use(cookieParser());

const corsOptions = {
    origin: FRONTEND_URL,
    credentials: true
};

app.use(cors(corsOptions));

app.options("*", cors(corsOptions));

// =========================
// RUTA PRINCIPAL
// =========================

app.get("/", (req, res) => {
    res.send("Backend VIP activo");
});

// =========================
// LOGIN CON PATREON
// =========================

app.get("/login", (req, res) => {
    try {
        const state = crypto.randomBytes(32).toString("hex");

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

        console.log("Redirigiendo a Patreon...");
        console.log("Redirect URI:", REDIRECT_URI);

        res.redirect(url);

    } catch (err) {
        console.error("ERROR LOGIN:", err);
        res.status(500).send(
            "Error iniciando sesión con Patreon."
        );
    }
});

// =========================
// CALLBACK DE PATREON
// =========================

app.get("/callback", async (req, res) => {

    const code = req.query.code;
    const state = req.query.state;

    // Patreon devolvió un error
    if (req.query.error) {

        console.error(
            "Patreon OAuth error:",
            req.query.error,
            req.query.error_description || ""
        );

        return res.redirect(
            FRONTEND_URL +
            "/vip.html?login_error=true"
        );
    }

    // No hay código
    if (!code) {

        return res.redirect(
            FRONTEND_URL +
            "/vip.html?login_error=true"
        );
    }

    // =========================
    // VERIFICAR STATE
    // =========================

    const savedState = req.cookies.oauth_state;

    if (!state || !savedState || state !== savedState) {

        console.error("OAuth state inválido.");

        return res.status(403).send(
            "Error de seguridad: estado OAuth inválido."
        );
    }

    res.clearCookie("oauth_state", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/"
    });

    try {

        // =========================
        // INTERCAMBIAR CODE POR TOKEN
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
                    "Content-Type":
                        "application/x-www-form-urlencoded",
                    Accept: "application/json"
                }
            }
        );

        const accessToken =
            tokenResponse.data.access_token;

        if (!accessToken) {
            throw new Error(
                "Patreon no devolvió access_token."
            );
        }

        // =========================
        // OBTENER USUARIO + MEMBRESÍAS
        // + CAMPAÑA
        // =========================

        const userResponse = await axios.get(
            "https://www.patreon.com/api/oauth2/v2/identity",
            {
                params: {
                    include: "memberships,memberships.campaign",

                    "fields[member]":
                        "patron_status,currently_entitled_amount_cents",

                    "fields[campaign]":
                        "vanity,creation_name"
                },

                headers: {
                    Authorization:
                        `Bearer ${accessToken}`,

                    Accept: "application/json"
                }
            }
        );

        const included =
            userResponse.data.included || [];

        // =========================
        // BUSCAR MEMBRESÍA ACTIVA
        // DE NUESTRA CAMPAÑA
        // =========================

        let membershipEncontrada = null;

        for (const member of included) {

            if (member.type !== "member") {
                continue;
            }

            const patronStatus =
                member.attributes?.patron_status;

            if (patronStatus !== "active_patron") {
                continue;
            }

            const campaignId =
                member.relationships?.campaign?.data?.id;

            if (!campaignId) {
                continue;
            }

            const campaign = included.find(
                item =>
                    item.type === "campaign" &&
                    item.id === campaignId
            );

            if (!campaign) {
                continue;
            }

            const vanity =
                campaign.attributes?.vanity;

            console.log(
                "Campaña encontrada:",
                vanity || "sin vanity"
            );

            if (
                vanity &&
                vanity.toLowerCase() ===
                PATREON_CAMPAIGN_VANITY.toLowerCase()
            ) {

                membershipEncontrada = member;
                break;
            }
        }

        // =========================
        // RESULTADO VIP
        // =========================

        const esVIP =
            !!membershipEncontrada;

        console.log(
            "¿Usuario VIP?:",
            esVIP
        );

        // =========================
        // NO ES VIP
        // =========================

        if (!esVIP) {

            return res.redirect(
                FRONTEND_URL +
                "/vip.html?no_membresia=true"
            );
        }

        // =========================
        // GUARDAR TOKEN
        // =========================

        res.cookie(
            "patreon_token",
            accessToken,
            {
                httpOnly: true,
                secure: true,
                sameSite: "none",
                path: "/",
                maxAge:
                    1000 *
                    60 *
                    60 *
                    24 *
                    30
            }
        );

        // =========================
        // ENTRAR AL VIP
        // =========================

        return res.redirect(
            FRONTEND_URL +
            "/vip.html"
        );

    } catch (err) {

        console.error(
            "ERROR CALLBACK:",
            err.response?.data ||
            err.message ||
            err
        );

        return res.redirect(
            FRONTEND_URL +
            "/vip.html?login_error=true"
        );
    }
});

// =========================
// COMPROBAR VIP
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

                    include:
                        "memberships,memberships.campaign",

                    "fields[member]":
                        "patron_status,currently_entitled_amount_cents",

                    "fields[campaign]":
                        "vanity,creation_name"
                },

                headers: {
                    Authorization:
                        `Bearer ${accessToken}`,

                    Accept: "application/json"
                }
            }
        );

        const included =
            userResponse.data.included || [];

        for (const member of included) {

            if (member.type !== "member") {
                continue;
            }

            if (
                member.attributes?.patron_status !==
                "active_patron"
            ) {
                continue;
            }

            const campaignId =
                member.relationships?.campaign?.data?.id;

            if (!campaignId) {
                continue;
            }

            const campaign = included.find(
                item =>
                    item.type === "campaign" &&
                    item.id === campaignId
            );

            if (!campaign) {
                continue;
            }

            const vanity =
                campaign.attributes?.vanity;

            if (
                vanity &&
                vanity.toLowerCase() ===
                PATREON_CAMPAIGN_VANITY.toLowerCase()
            ) {
                return true;
            }
        }

        return false;

    } catch (err) {

        console.error(
            "Error comprobando Patreon:",
            err.response?.data ||
            err.message
        );

        return false;
    }
}

// =========================
// VIP CHECK
// =========================

app.get("/vip-check", async (req, res) => {

    const accessToken =
        req.cookies.patreon_token;

    if (!accessToken) {

        return res.json({
            vip: false
        });
    }

    const esVIP =
        await comprobarVIP(accessToken);

    if (!esVIP) {

        res.clearCookie(
            "patreon_token",
            {
                httpOnly: true,
                secure: true,
                sameSite: "none",
                path: "/"
            }
        );

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

    res.clearCookie(
        "patreon_token",
        {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: "/"
        }
    );

    res.redirect(
        FRONTEND_URL +
        "/vip.html"
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
