# Cloudflare Tunnel — Mobile from a Different Network

Use **Cloudflare Tunnel** (cloudflared) to expose your local server to the internet so the mobile app can connect from any network (cellular, another WiFi) without opening ports or running a VPN.

## Implementation options

### Option A — Main server only (simplest)

Expose only the main server (port 3456). Preview URLs that point to other local ports (e.g. 5173) will **not** work from a different network unless you add Option C.

**Steps:**

1. Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/).
2. Start the backend: `npm run dev`.
3. In another terminal, run a quick tunnel to the server:
   ```bash
   cloudflared tunnel --url http://localhost:3456
   ```
4. Copy the printed URL (e.g. `https://abc-123.trycloudflare.com`).
5. Start the mobile app with that URL:
   ```bash
   EXPO_PUBLIC_SERVER_URL=https://abc-123.trycloudflare.com npm run -w mobile start
   ```
6. On the phone (any network), open the app and set the server URL to the tunnel URL (or use the same env when building).

**Limitation:** In-app “Open web preview” for URLs like `http://localhost:5173` will not load from a different network (device cannot reach your Mac’s localhost). Use Option B or C if you need preview.

---

### Option B — One tunnel to local proxy (API + preview)

Use the **local reverse proxy** (port 9443), which routes by `X-Target-Port` / `_targetPort` to different local ports. One Cloudflare tunnel exposes that proxy; the app uses a single public URL and preview rewriting via `_targetPort`.

**Architecture:**

- **Mac:** Backend (3456) + proxy (9443) + cloudflared → `https://xxx.trycloudflare.com` → proxy → localhost:3456 or localhost:&lt;port&gt;.
- **Mobile:** `EXPO_PUBLIC_SERVER_URL=https://xxx.trycloudflare.com` and `EXPO_PUBLIC_CONNECTION_MODE=cloudflare`. Preview URLs are rewritten to the same host with `_targetPort` so the proxy can route to the correct local port.

**Steps:**

1. Install cloudflared (e.g. `brew install cloudflared`).
2. **One-command start** (recommended): from repo root run
   ```bash
   npm run dev:cloudflare
   ```
   This starts the proxy, dev server, and Cloudflare tunnel. When the tunnel URL appears in the output, copy it.
3. In a **second terminal**, start the mobile app with that URL and cloudflare mode:
   ```bash
   EXPO_PUBLIC_SERVER_URL=https://YOUR_TUNNEL_URL npm run dev:mobile:cloudflare
   ```
   (Replace `YOUR_TUNNEL_URL` with the URL printed by `dev:cloudflare`, e.g. `abc-123.trycloudflare.com`.)

**Alternative — separate terminals:** Start proxy, dev server, and tunnel yourself:
   ```bash
   npm run proxy         # Terminal 1
   npm run dev           # Terminal 2
   npm run cloudflare:tunnel   # Terminal 3 — copy the printed URL
   ```
   Then: `EXPO_PUBLIC_SERVER_URL=https://YOUR_TUNNEL_URL npm run dev:mobile:cloudflare`.

**Result:** One URL for API and for preview; preview works from any network as long as the dev server for that port (e.g. 5173) is running on your Mac.

---

### Option C — Two tunnels (main + preview host)

If you prefer not to use the proxy, run two quick tunnels and use the app’s existing “direct” mode with a separate preview host:

1. Tunnel 1 — main server: `cloudflared tunnel --url http://localhost:3456` → e.g. `https://api-xxx.trycloudflare.com`
2. Tunnel 2 — preview (e.g. Vite): `cloudflared tunnel --url http://localhost:5173` → e.g. `https://preview-xxx.trycloudflare.com`
3. Start the app with:
   ```bash
   EXPO_PUBLIC_SERVER_URL=https://api-xxx.trycloudflare.com \
   EXPO_PUBLIC_PREVIEW_HOST=https://preview-xxx.trycloudflare.com \
   npm run -w mobile start
   ```
4. Keep connection mode as `direct`. The app’s `resolvePreviewUrl` will replace localhost preview URLs with `EXPO_PUBLIC_PREVIEW_HOST` when the base URL is not localhost.

**Limitation:** You must run and update two tunnels and two URLs when they change (quick tunnels get new URLs on restart).

---

## Recommended: Option B (one tunnel + proxy)

- Single URL to remember.
- Preview works from any network via the proxy and `_targetPort` routing.

## Environment summary

| Variable | Option A | Option B | Option C |
|----------|----------|----------|----------|
| `EXPO_PUBLIC_SERVER_URL` | Tunnel URL to :3456 | Tunnel URL to :9443 (proxy) | Tunnel URL to :3456 |
| `EXPO_PUBLIC_CONNECTION_MODE` | `direct` | `cloudflare` | `direct` |
| `EXPO_PUBLIC_PREVIEW_HOST` | — | — | Second tunnel URL (e.g. :5173) |

## Security note

Quick tunnels (`trycloudflare.com`) are public and unauthenticated. Anyone with the URL can hit your local server. Use for development only. For a fixed hostname and optional access policies, use a [named Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/) with a custom domain and Cloudflare Access.
