const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8000);
const APP_ORIGIN = new URL(process.env.APP_ORIGIN || `http://localhost:${PORT}`).origin;

function sendJson(response, status, value) {
    response.writeHead(status, {
        'Cache-Control': 'no-store',
        'Content-Type': 'application/json; charset=utf-8'
    });
    response.end(JSON.stringify(value));
}

function getStaticFile(pathname) {
    if (pathname === '/' || pathname === '/index.html' || pathname === '/loop-kicker-journey.html') return 'index.html';
    if (/^\/js\/[a-z0-9-]+\.js$/i.test(pathname) || pathname === '/css/styles.css') return pathname.slice(1);
    if (
        pathname === '/loop-kicker-journey-models.js'
        || pathname === '/sterzo-challenge-codes.js'
        || pathname === '/loop-kicker-journey.svg'
    ) {
        return pathname.slice(1);
    }
    if (/^\/docs\/screenshots\/[a-z0-9-]+\.png$/i.test(pathname)) return pathname.slice(1);
    return null;
}

function contentType(filePath) {
    if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
    if (filePath.endsWith('.js')) return 'text/javascript; charset=utf-8';
    if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
    if (filePath.endsWith('.svg')) return 'image/svg+xml';
    if (filePath.endsWith('.png')) return 'image/png';
    return 'application/octet-stream';
}

async function handleRequest(request, response) {
    const url = new URL(request.url, APP_ORIGIN);

    if (request.method !== 'GET' || url.pathname.startsWith('/api/')) {
        sendJson(response, 404, { error: 'Not found.' });
        return;
    }

    const pathname = decodeURIComponent(url.pathname);
    const relativePath = getStaticFile(pathname);
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
    console.log(`Loop Kicker Journey listening on ${APP_ORIGIN}`);
});

module.exports = { server };
