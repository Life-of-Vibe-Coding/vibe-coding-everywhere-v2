# Quick Start Guide

Get up and running in 5 minutes.

## Prerequisites

- Node.js 18+
- **Pi** coding agent: `npm i -g @mariozechner/pi-coding-agent`, then `pi --version`. Pi supports Claude, Codex, and Gemini via subscription auth—run `pi` and `/login` once; no API keys needed.
- (Optional) Cloudflare Tunnel for mobile from a different network

## 1. Install

```bash
git clone <repo-url>
cd vibe-coding-everywhere
npm install
```

## 2. Start Server

```bash
npm start
```

Server runs at `http://localhost:3456`.

## 3. Open Web Client

Visit http://localhost:3456 in your browser.

Start chatting! The default provider is configurable via `DEFAULT_PROVIDER` (env: `claude`, `gemini`, or `codex`).

## Mobile Setup (Optional)

### Same Machine (Simulator)

```bash
# Terminal 1
npm start

# Terminal 2
npm run dev:mobile
```

### Physical Device (different network)

Use [Cloudflare Tunnel](CLOUDFLARE_TUNNEL.md): run `npm run dev:cloudflare`, then start the app with the tunnel URL:

```bash
EXPO_PUBLIC_SERVER_URL=https://YOUR_TUNNEL_URL npm run dev:mobile:cloudflare
```

Scan QR code with Expo Go app.

## Common Commands

```bash
# Dev mode with auto-restart
npm run dev

# With custom workspace
npm start -- /path/to/project

# With custom port
PORT=3457 npm start
```

## Next Steps

- Read [Architecture Guide](ARCHITECTURE.md) for system overview
- Read [API Documentation](API.md) for event reference
- Read [Development Guide](DEVELOPMENT.md) for contributing
- Read [Deployment Guide](DEPLOYMENT.md) for production setup

## Troubleshooting

**Pi not found?**
```bash
npm i -g @mariozechner/pi-coding-agent
which pi && pi --version
# Run pi and /login once to authenticate
```

**Port in use?**
```bash
PORT=3457 npm start
```

**Mobile won't connect?**
```bash
# Check server
curl http://localhost:3456/api/config

# For tunnel: ensure proxy is running (npm run proxy) when using Cloudflare
```
