#!/usr/bin/env bash
# ==============================================================================
# OpenZiti Network Setup for Vibe Coding
#
# This script sets up a complete OpenZiti overlay network:
#   1. Controller + Edge Router (via quickstart or existing)
#   2. Server identity (Mac tunneler - binds/hosts services)
#   3. Client identity (mobile app - dials services)
#   4. Services: vibe-coding-proxy → tcp:localhost:PROXY_PORT
#
# Prerequisites:
#   - ziti CLI installed: https://openziti.io/docs/learn/quickstarts/network/local-no-docker/
#   - Or use NetFoundry cloud: https://netfoundry.io
#
# Usage:
#   ./scripts/setup-ziti-network.sh
#
# After running, you'll have:
#   - server identity file: .ziti/identities/vibe-server.json
#   - client identity file: .ziti/identities/vibe-client.json
#   - service: vibe-coding-proxy bound to tcp:localhost:9443
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ZITI_DIR="$PROJECT_ROOT/.ziti"
IDENTITIES_DIR="$ZITI_DIR/identities"

# Configuration (override via env)
ZITI_CTRL_URL="${ZITI_CTRL_URL:-}"
ZITI_USER="${ZITI_USER:-admin}"
ZITI_PASS="${ZITI_PASS:-}"
PROXY_PORT="${ZITI_PROXY_PORT:-9443}"
SERVICE_NAME="${ZITI_SERVICE_NAME:-vibe-coding-proxy}"
SERVER_IDENTITY_NAME="${ZITI_SERVER_IDENTITY:-vibe-server}"
CLIENT_IDENTITY_NAME="${ZITI_CLIENT_IDENTITY:-vibe-client}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[ziti-setup]${NC} $*"; }
warn() { echo -e "${YELLOW}[ziti-setup]${NC} $*"; }
error() { echo -e "${RED}[ziti-setup]${NC} $*" >&2; }

# ---- Pre-checks ----
if ! command -v ziti &>/dev/null; then
  error "ziti CLI not found. Install it first:"
  echo "  brew install openziti/tap/ziti"
  echo "  # or see: https://openziti.io/docs/learn/quickstarts/network/local-no-docker/"
  exit 1
fi

mkdir -p "$IDENTITIES_DIR"

# ---- Login to controller ----
if [[ -z "$ZITI_CTRL_URL" ]]; then
  warn "ZITI_CTRL_URL not set."
  echo ""
  echo "If you have a running Ziti controller, set:"
  echo "  export ZITI_CTRL_URL=https://your-controller:1280"
  echo "  export ZITI_USER=admin"
  echo "  export ZITI_PASS=your-password"
  echo ""
  echo "To start a local quickstart controller:"
  echo "  ziti edge quickstart"
  echo "  # Then re-run this script with the controller URL."
  echo ""
  error "Cannot proceed without ZITI_CTRL_URL."
  exit 1
fi

if [[ -z "$ZITI_PASS" ]]; then
  error "ZITI_PASS not set. Export it before running this script."
  exit 1
fi

log "Logging in to Ziti controller at $ZITI_CTRL_URL ..."
ziti edge login "$ZITI_CTRL_URL" -u "$ZITI_USER" -p "$ZITI_PASS" --yes

# ---- Create server identity ----
log "Creating server identity: $SERVER_IDENTITY_NAME ..."
if ziti edge list identities "filter name=\"$SERVER_IDENTITY_NAME\"" 2>/dev/null | grep -q "$SERVER_IDENTITY_NAME"; then
  warn "Server identity '$SERVER_IDENTITY_NAME' already exists. Skipping creation."
else
  ziti edge create identity "$SERVER_IDENTITY_NAME" \
    --role-attributes "vibe-servers" \
    -o "$IDENTITIES_DIR/${SERVER_IDENTITY_NAME}.jwt"
  log "Enrolling server identity ..."
  ziti edge enroll "$IDENTITIES_DIR/${SERVER_IDENTITY_NAME}.jwt" \
    -o "$IDENTITIES_DIR/${SERVER_IDENTITY_NAME}.json"
  rm -f "$IDENTITIES_DIR/${SERVER_IDENTITY_NAME}.jwt"
fi

# ---- Create client identity ----
log "Creating client identity: $CLIENT_IDENTITY_NAME ..."
if ziti edge list identities "filter name=\"$CLIENT_IDENTITY_NAME\"" 2>/dev/null | grep -q "$CLIENT_IDENTITY_NAME"; then
  warn "Client identity '$CLIENT_IDENTITY_NAME' already exists. Skipping creation."
else
  ziti edge create identity "$CLIENT_IDENTITY_NAME" \
    --role-attributes "vibe-clients" \
    -o "$IDENTITIES_DIR/${CLIENT_IDENTITY_NAME}.jwt"
  log "Enrolling client identity ..."
  ziti edge enroll "$IDENTITIES_DIR/${CLIENT_IDENTITY_NAME}.jwt" \
    -o "$IDENTITIES_DIR/${CLIENT_IDENTITY_NAME}.json"
  rm -f "$IDENTITIES_DIR/${CLIENT_IDENTITY_NAME}.jwt"
fi

# ---- Create service ----
log "Creating service: $SERVICE_NAME (→ tcp:localhost:$PROXY_PORT) ..."
if ziti edge list services "filter name=\"$SERVICE_NAME\"" 2>/dev/null | grep -q "$SERVICE_NAME"; then
  warn "Service '$SERVICE_NAME' already exists. Skipping creation."
else
  ziti edge create service "$SERVICE_NAME" \
    --role-attributes "vibe-services"
fi

# ---- Create service configs ----
log "Creating intercept and host configs ..."

INTERCEPT_CONFIG_NAME="${SERVICE_NAME}-intercept"
HOST_CONFIG_NAME="${SERVICE_NAME}-host"

# Host config: tunneler binds service to localhost:PROXY_PORT
if ! ziti edge list configs "filter name=\"$HOST_CONFIG_NAME\"" 2>/dev/null | grep -q "$HOST_CONFIG_NAME"; then
  ziti edge create config "$HOST_CONFIG_NAME" host.v1 \
    "{\"protocol\": \"tcp\", \"address\": \"localhost\", \"port\": $PROXY_PORT}"
fi

# Intercept config: clients can dial the service
if ! ziti edge list configs "filter name=\"$INTERCEPT_CONFIG_NAME\"" 2>/dev/null | grep -q "$INTERCEPT_CONFIG_NAME"; then
  ziti edge create config "$INTERCEPT_CONFIG_NAME" intercept.v1 \
    "{\"protocols\": [\"tcp\"], \"addresses\": [\"${SERVICE_NAME}.ziti\"], \"portRanges\": [{\"low\": $PROXY_PORT, \"high\": $PROXY_PORT}]}"
fi

# ---- Create service edge router policy ----
log "Creating service edge router policy ..."
SERP_NAME="${SERVICE_NAME}-serp"
if ! ziti edge list service-edge-router-policies "filter name=\"$SERP_NAME\"" 2>/dev/null | grep -q "$SERP_NAME"; then
  ziti edge create service-edge-router-policy "$SERP_NAME" \
    --service-roles "@${SERVICE_NAME}" \
    --edge-router-roles "#all"
fi

# ---- Create bind policy (server can host) ----
log "Creating bind service policy ..."
BIND_POLICY_NAME="${SERVICE_NAME}-bind"
if ! ziti edge list service-policies "filter name=\"$BIND_POLICY_NAME\"" 2>/dev/null | grep -q "$BIND_POLICY_NAME"; then
  ziti edge create service-policy "$BIND_POLICY_NAME" Bind \
    --service-roles "@${SERVICE_NAME}" \
    --identity-roles "#vibe-servers"
fi

# ---- Create dial policy (client can dial) ----
log "Creating dial service policy ..."
DIAL_POLICY_NAME="${SERVICE_NAME}-dial"
if ! ziti edge list service-policies "filter name=\"$DIAL_POLICY_NAME\"" 2>/dev/null | grep -q "$DIAL_POLICY_NAME"; then
  ziti edge create service-policy "$DIAL_POLICY_NAME" Dial \
    --service-roles "@${SERVICE_NAME}" \
    --identity-roles "#vibe-clients"
fi

# ---- Summary ----
echo ""
log "=========================================="
log "Ziti network setup complete!"
log "=========================================="
echo ""
echo "  Service:          $SERVICE_NAME"
echo "  Proxy port:       $PROXY_PORT"
echo "  Server identity:  $IDENTITIES_DIR/${SERVER_IDENTITY_NAME}.json"
echo "  Client identity:  $IDENTITIES_DIR/${CLIENT_IDENTITY_NAME}.json"
echo ""
echo "Next steps:"
echo ""
echo "  1. Start the reverse proxy + tunneler on your Mac:"
echo "     npm run ziti:proxy"
echo ""
echo "  2. Start the Ziti tunneler in host mode:"
echo "     npm run ziti:tunneler"
echo ""
echo "  3. Start the mobile app in Ziti mode:"
echo "     npm run dev:mobile:ziti"
echo ""
echo "  Or start everything together:"
echo "     npm run dev:ziti"
echo ""
