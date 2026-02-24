#!/usr/bin/env bash
# ==============================================================================
# Start Ziti Edge Tunneler in run-host mode
#
# This runs the Ziti tunneler on your Mac so it binds the "vibe-coding-proxy"
# service to tcp:localhost:9443 (where the reverse proxy listens).
#
# The tunneler uses the server identity created by setup-ziti-network.sh.
#
# Usage:
#   ./scripts/start-ziti-tunneler.sh
#   # or: npm run ziti:tunneler
#
# Environment:
#   ZITI_SERVER_IDENTITY  - Path to server identity JSON (default: .ziti/identities/vibe-server.json)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

IDENTITY_FILE="${ZITI_SERVER_IDENTITY:-$PROJECT_ROOT/.ziti/identities/vibe-server.json}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

if [[ ! -f "$IDENTITY_FILE" ]]; then
  echo -e "${RED}[ziti-tunneler]${NC} Identity file not found: $IDENTITY_FILE"
  echo ""
  echo "Run the setup script first:"
  echo "  ./scripts/setup-ziti-network.sh"
  exit 1
fi

if ! command -v ziti-edge-tunnel &>/dev/null; then
  # Try ziti tunnel as fallback (newer CLI bundles tunneler)
  if command -v ziti &>/dev/null; then
    echo -e "${GREEN}[ziti-tunneler]${NC} Using 'ziti tunnel' (bundled tunneler)"
    echo -e "${GREEN}[ziti-tunneler]${NC} Identity: $IDENTITY_FILE"
    echo -e "${GREEN}[ziti-tunneler]${NC} Mode: run-host (bind services to local ports)"
    exec ziti tunnel run-host -i "$IDENTITY_FILE"
  fi
  echo -e "${RED}[ziti-tunneler]${NC} Neither ziti-edge-tunnel nor ziti CLI found."
  echo ""
  echo "Install the tunneler:"
  echo "  brew install openziti/tap/ziti-edge-tunnel"
  echo "  # or see: https://openziti.io/docs/reference/tunnelers/"
  exit 1
fi

echo -e "${GREEN}[ziti-tunneler]${NC} Starting Ziti Edge Tunneler in run-host mode"
echo -e "${GREEN}[ziti-tunneler]${NC} Identity: $IDENTITY_FILE"
echo -e "${GREEN}[ziti-tunneler]${NC} Mode: run-host (bind services to local ports)"

exec ziti-edge-tunnel run-host -i "$IDENTITY_FILE"
