/**
 * Ziti Reverse Proxy — Port Multiplexer
 *
 * A lightweight HTTP reverse proxy that runs on the developer's Mac alongside the
 * Express server. The Ziti tunneler binds ONE service to this proxy's port (default 9443).
 * The mobile app sends all traffic through the Ziti overlay to this proxy, which routes
 * to the correct localhost port based on the X-Target-Port header.
 *
 * Routing logic:
 *   1. X-Target-Port header → forwards to localhost:<that port>
 *   2. No header → forwards to localhost:3456 (main server)
 *
 * Single Ziti service for API and preview routing
 * that can route to any local port.
 *
 * Usage:
 *   node server/ziti/proxy.js
 *   # or: ZITI_PROXY_PORT=9443 ZITI_DEFAULT_TARGET_PORT=3456 node server/ziti/proxy.js
 *
 * Environment:
 *   ZITI_PROXY_PORT         - Port this proxy listens on (default: 9443)
 *   ZITI_DEFAULT_TARGET_PORT - Default backend port when X-Target-Port is absent (default: PORT or 3456)
 *   PORT                    - Main server port fallback (default: 3456)
 */
import http from "http";
import { URL } from "url";

const PROXY_PORT = parseInt(process.env.ZITI_PROXY_PORT || "9443", 10);
const DEFAULT_TARGET_PORT = parseInt(
  process.env.ZITI_DEFAULT_TARGET_PORT || process.env.PORT || "3456",
  10
);

/**
 * Allowed port range to prevent abuse. Only forward to localhost ports in this range.
 * Covers common dev ports (3000-9999) plus the main server range.
 */
const MIN_PORT = 1024;
const MAX_PORT = 65535;

function isValidPort(port) {
  return Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT;
}

const server = http.createServer((req, res) => {
  // Determine target port from X-Target-Port header, _targetPort query param, or default.
  // Query param is used by WebView requests which can't set custom headers.
  const targetPortHeader = req.headers["x-target-port"];
  let targetPort = DEFAULT_TARGET_PORT;
  let reqUrl = req.url;

  if (targetPortHeader) {
    const parsed = parseInt(String(targetPortHeader), 10);
    if (isValidPort(parsed)) {
      targetPort = parsed;
    } else {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Invalid X-Target-Port: ${targetPortHeader}` }));
      return;
    }
  } else {
    // Check for _targetPort query parameter
    try {
      const urlObj = new URL(reqUrl, `http://127.0.0.1:${PROXY_PORT}`);
      const qPort = urlObj.searchParams.get("_targetPort");
      if (qPort) {
        const parsed = parseInt(qPort, 10);
        if (isValidPort(parsed)) {
          targetPort = parsed;
          // Remove _targetPort from the URL before forwarding
          urlObj.searchParams.delete("_targetPort");
          reqUrl = urlObj.pathname + urlObj.search + urlObj.hash;
        }
      }
    } catch {
      // Malformed URL; use defaults
    }
  }

  // Build proxy request options
  const options = {
    hostname: "127.0.0.1",
    port: targetPort,
    path: reqUrl,
    method: req.method,
    headers: { ...req.headers },
  };

  // Remove proxy-specific headers before forwarding
  delete options.headers["x-target-port"];
  // Update host header to match target
  options.headers.host = `127.0.0.1:${targetPort}`;

  const proxyReq = http.request(options, (proxyRes) => {
    // Add header so the client knows which port responded
    res.writeHead(proxyRes.statusCode, {
      ...proxyRes.headers,
      "x-proxied-port": String(targetPort),
    });
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on("error", (err) => {
    console.error(`[ziti-proxy] Error forwarding to localhost:${targetPort}:`, err.message);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Bad Gateway",
          message: `Cannot reach localhost:${targetPort}`,
          port: targetPort,
        })
      );
    }
  });

  req.pipe(proxyReq, { end: true });
});

// Handle WebSocket / SSE upgrade for Socket.IO and EventSource
server.on("upgrade", (req, socket, head) => {
  const targetPortHeader = req.headers["x-target-port"];
  let targetPort = DEFAULT_TARGET_PORT;

  if (targetPortHeader) {
    const parsed = parseInt(String(targetPortHeader), 10);
    if (isValidPort(parsed)) {
      targetPort = parsed;
    } else {
      socket.destroy();
      return;
    }
  }

  const options = {
    hostname: "127.0.0.1",
    port: targetPort,
    path: req.url,
    method: req.method,
    headers: { ...req.headers },
  };
  delete options.headers["x-target-port"];
  options.headers.host = `127.0.0.1:${targetPort}`;

  const proxyReq = http.request(options);
  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    socket.write(
      `HTTP/1.1 101 Switching Protocols\r\n` +
        Object.entries(proxyRes.headers)
          .map(([k, v]) => `${k}: ${v}`)
          .join("\r\n") +
        "\r\n\r\n"
    );
    if (proxyHead.length) socket.write(proxyHead);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on("error", (err) => {
    console.error(`[ziti-proxy] WebSocket upgrade error to localhost:${targetPort}:`, err.message);
    socket.destroy();
  });

  proxyReq.end();
});

const BIND_HOST = process.env.ZITI_PROXY_BIND || "0.0.0.0";

server.listen(PROXY_PORT, BIND_HOST, () => {
  console.log(`[ziti-proxy] Reverse proxy listening on ${BIND_HOST}:${PROXY_PORT}`);
  console.log(`[ziti-proxy] Default target: localhost:${DEFAULT_TARGET_PORT}`);
  console.log(`[ziti-proxy] Use X-Target-Port header or _targetPort query to route to other ports`);
});

process.on("SIGINT", () => {
  console.log("[ziti-proxy] Shutting down...");
  server.close(() => process.exit(0));
});
process.on("SIGTERM", () => {
  console.log("[ziti-proxy] Shutting down...");
  server.close(() => process.exit(0));
});
