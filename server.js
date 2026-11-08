const { createServer } = require('node:http');
const { randomBytes } = require('node:crypto');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8000);
const APP_ORIGIN = new URL(process.env.APP_ORIGIN || `http://localhost:${PORT}`).origin;
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || '';
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET || '';
const STRAVA_REDIRECT_URI = `${APP_ORIGIN}/api/strava/callback`;
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
const SESSION_COOKIE = 'performed3d_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const MAX_FIT_FILE_BYTES = 20 * 1024 * 1024;
const sessions = new Map();

function sendJson(response, status, value) {
    response.writeHead(status, {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8'
    });
    response.end(JSON.stringify(value));
}

function redirect(response, location) {
    response.writeHead(303, { 'Cache-Control': 'no-store', Location: location });
    response.end();
}

function makeSessionCookie(id, maxAge = SESSION_TTL_MS / 1000) {
    return `${SESSION_COOKIE}=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${COOKIE_SECURE ? '; Secure' : ''}`;
}

function getSession(request, response) {
    const cookie = request.headers.cookie || '';
    const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([a-f0-9]{64})(?:;|$)`));
    const now = Date.now();

    for (const [id, session] of sessions) {
        if (session.expiresAt <= now) sessions.delete(id);
    }

    let id = match && match[1];
    let session = id && sessions.get(id);
    if (!session) {
        id = randomBytes(32).toString('hex');
        session = {};
        sessions.set(id, session);
        response.setHeader('Set-Cookie', makeSessionCookie(id));
    }

    session.expiresAt = now + SESSION_TTL_MS;
    return session;
}

function isStravaConfigured() {
    return Boolean(STRAVA_CLIENT_ID && STRAVA_CLIENT_SECRET);
}

function requireSameOrigin(request, response) {
    if (request.headers.origin !== APP_ORIGIN) {
        sendJson(response, 403, { error: 'Request origin is not allowed.' });
        return false;
    }
    return true;
}

async function readRequestBody(request, limit) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        size += chunk.length;
        if (size > limit) {
            const error = new Error('Request body is too large.');
            error.statusCode = 413;
            throw error;
        }
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

async function stravaJson(response) {
    const text = await response.text();
    let data;
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = {};
    }
    if (!response.ok) {
        const detail = data.message || data.error || `Strava returned HTTP ${response.status}.`;
        throw new Error(String(detail).slice(0, 400));
    }
    return data;
}

async function refreshStravaToken(session) {
    const token = session.strava;
    const form = new URLSearchParams({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken
    });
    const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form
    });
    const refreshed = await stravaJson(response);
    token.accessToken = refreshed.access_token;
    token.refreshToken = refreshed.refresh_token;
    token.expiresAt = refreshed.expires_at;
    if (refreshed.athlete) token.athlete = refreshed.athlete;
}

async function stravaFetch(session, url, options = {}) {
    if (session.strava.expiresAt <= Math.floor(Date.now() / 1000) + 60) {
        await refreshStravaToken(session);
    }

    let response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            Authorization: `Bearer ${session.strava.accessToken}`
        }
    });

    if (response.status === 401) {
        await refreshStravaToken(session);
        response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                Authorization: `Bearer ${session.strava.accessToken}`
            }
        });
    }
    return response;
}

function getStaticFile(pathname) {
    if (pathname === '/' || pathname === '/performed3d.html') return 'performed3d.html';
    if (pathname === '/performed3d-models.js' || pathname === '/sterzo-challenge-codes.js' || pathname === '/performed3d.svg') {
        return pathname.slice(1);
    }
    if (/^\/docs\/screenshots\/[a-z0-9-]+\.png$/i.test(pathname)) return pathname.slice(1);
    return null;
}

function contentType(filePath) {
    if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
    if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
    if (filePath.endsWith('.svg')) return 'image/svg+xml';
    if (filePath.endsWith('.png')) return 'image/png';
    return 'application/octet-stream';
}

async function handleRequest(request, response) {
    const url = new URL(request.url, APP_ORIGIN);
    const session = getSession(request, response);

    if (url.pathname === '/api/strava/status' && request.method === 'GET') {
        const athlete = session.strava && session.strava.athlete;
        sendJson(response, 200, {
            configured: isStravaConfigured(),
            connected: Boolean(session.strava),
            athlete: athlete ? { firstname: athlete.firstname, lastname: athlete.lastname } : null,
            notice: session.stravaNotice || null
        });
        session.stravaNotice = null;
        return;
    }

    if (url.pathname === '/api/strava/connect' && request.method === 'GET') {
        if (!isStravaConfigured()) {
            sendJson(response, 503, { error: 'Strava OAuth is not configured on this server.' });
            return;
        }
        const state = randomBytes(32).toString('hex');
        session.oauthState = state;
        const authorizeUrl = new URL('https://www.strava.com/oauth/authorize');
        authorizeUrl.search = new URLSearchParams({
            client_id: STRAVA_CLIENT_ID,
            redirect_uri: STRAVA_REDIRECT_URI,
            response_type: 'code',
            approval_prompt: 'auto',
            scope: 'activity:write',
            state
        }).toString();
        response.writeHead(302, { 'Cache-Control': 'no-store', Location: authorizeUrl.toString() });
        response.end();
        return;
    }

    if (url.pathname === '/api/strava/callback' && request.method === 'GET') {
        const state = url.searchParams.get('state');
        const code = url.searchParams.get('code');
        if (!session.oauthState || state !== session.oauthState) {
            session.stravaNotice = 'Strava authorization could not be verified. Please try connecting again.';
            redirect(response, '/performed3d.html?strava=error');
            return;
        }
        delete session.oauthState;
        if (url.searchParams.has('error') || !code) {
            session.stravaNotice = 'Strava connection was cancelled.';
            redirect(response, '/performed3d.html?strava=cancelled');
            return;
        }

        try {
            const form = new URLSearchParams({
                client_id: STRAVA_CLIENT_ID,
                client_secret: STRAVA_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code'
            });
            const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: form
            });
            const token = await stravaJson(tokenResponse);
            if (!token.access_token || !token.refresh_token || !token.expires_at) {
                throw new Error('Strava returned an incomplete OAuth response.');
            }
            if (!String(token.scope || '').split(/[ ,]+/).includes('activity:write')) {
                throw new Error('Strava activity upload permission was not granted.');
            }
            session.strava = {
                accessToken: token.access_token,
                refreshToken: token.refresh_token,
                expiresAt: token.expires_at,
                athlete: token.athlete || null
            };
            session.stravaNotice = 'Strava account connected.';
            redirect(response, '/performed3d.html?strava=connected');
        } catch (error) {
            session.stravaNotice = `Strava connection failed: ${error.message}`;
            redirect(response, '/performed3d.html?strava=error');
        }
        return;
    }

    if (url.pathname === '/api/strava/disconnect' && request.method === 'POST') {
        if (!requireSameOrigin(request, response)) return;
        if (session.strava) {
            try {
                const revokeResponse = await fetch('https://www.strava.com/oauth/revoke', {
                    method: 'POST',
                    headers: {
                        Authorization: `Basic ${Buffer.from(`${STRAVA_CLIENT_ID}:${STRAVA_CLIENT_SECRET}`).toString('base64')}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams({
                        token: session.strava.refreshToken,
                        token_type_hint: 'refresh_token'
                    })
                });
                await stravaJson(revokeResponse);
            } catch (error) {
                sendJson(response, 502, { error: `Could not revoke Strava access: ${error.message}` });
                return;
            }
        }
        delete session.strava;
        sendJson(response, 200, { connected: false });
        return;
    }

    if (url.pathname === '/api/strava/upload' && request.method === 'POST') {
        if (!requireSameOrigin(request, response)) return;
        if (!session.strava) {
            sendJson(response, 401, { error: 'Connect a Strava account before uploading.' });
            return;
        }
        if (request.headers['content-type'] !== 'application/octet-stream') {
            sendJson(response, 415, { error: 'Expected a FIT file upload.' });
            return;
        }

        try {
            const fitFile = await readRequestBody(request, MAX_FIT_FILE_BYTES);
            if (fitFile.length < 14 || fitFile.subarray(8, 12).toString('ascii') !== '.FIT') {
                sendJson(response, 400, { error: 'The uploaded file is not a valid FIT activity.' });
                return;
            }
            const encodedName = request.headers['x-activity-name'] || '';
            const decodedName = encodedName ? decodeURIComponent(encodedName) : 'Performed 3D Indoor Ride';
            const name = decodedName
                .replace(/[\r\n\0]/g, ' ')
                .trim()
                .slice(0, 100) || 'Performed 3D Indoor Ride';
            const form = new FormData();
            form.set('file', new Blob([fitFile], { type: 'application/octet-stream' }), 'performed3d.fit');
            form.set('data_type', 'fit');
            form.set('name', name);
            const uploadResponse = await stravaFetch(session, 'https://www.strava.com/api/v3/uploads', {
                method: 'POST',
                body: form
            });
            sendJson(response, 200, await stravaJson(uploadResponse));
        } catch (error) {
            sendJson(response, error.statusCode || 502, { error: `Strava upload failed: ${error.message}` });
        }
        return;
    }

    const uploadMatch = url.pathname.match(/^\/api\/strava\/uploads\/(\d+)$/);
    if (uploadMatch && request.method === 'GET') {
        if (!session.strava) {
            sendJson(response, 401, { error: 'Connect a Strava account before checking upload status.' });
            return;
        }
        try {
            const uploadResponse = await stravaFetch(
                session,
                `https://www.strava.com/api/v3/uploads/${uploadMatch[1]}`
            );
            sendJson(response, 200, await stravaJson(uploadResponse));
        } catch (error) {
            sendJson(response, 502, { error: `Could not check Strava upload: ${error.message}` });
        }
        return;
    }

    if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
        sendJson(response, 404, { error: 'Not found.' });
        return;
    }

    const relativePath = getStaticFile(decodeURIComponent(url.pathname));
    if (!relativePath) {
        sendJson(response, 404, { error: 'Not found.' });
        return;
    }

    try {
        const filePath = path.resolve(ROOT, relativePath);
        if (!filePath.startsWith(`${ROOT}${path.sep}`)) {
            sendJson(response, 404, { error: 'Not found.' });
            return;
        }
        const content = await readFile(filePath);
        response.writeHead(200, {
            'Cache-Control': 'no-cache',
            'Content-Type': contentType(filePath),
            'X-Content-Type-Options': 'nosniff'
        });
        response.end(content);
    } catch (error) {
        if (error.code === 'ENOENT') {
            sendJson(response, 404, { error: 'Not found.' });
            return;
        }
        sendJson(response, 500, { error: 'Could not load the requested file.' });
    }
}

const server = createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
        if (!response.headersSent) {
            sendJson(response, 500, { error: 'The request could not be completed.' });
        } else {
            response.destroy(error);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Performed 3D listening on ${APP_ORIGIN}`);
    if (!isStravaConfigured()) {
        console.log('Strava uploads are disabled; configure STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET to enable them.');
    }
});

module.exports = { server };
