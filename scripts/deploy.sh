#!/usr/bin/env bash
set -euo pipefail

APP="bekk-flyt-mcp"
ENV_FILE=".koyeb.env"

# --- helpers --------------------------------------------------------------

ensure_cli() {
  if ! command -v koyeb >/dev/null 2>&1; then
    echo "❌ Koyeb CLI not found. Install first: brew install koyeb/tap/koyeb"
    exit 1
  fi
}

set_env() {
  local key="$1" val="$2"
  [[ -f "$ENV_FILE" ]] || touch "$ENV_FILE"
  if grep -q "^${key}=" "$ENV_FILE"; then
    # macOS/BSD-compatible inline edit
    sed -i'' -e "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

# --- main ----------------------------------------------------------------

ensure_cli

# Load local env if present
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

# Accept overrides from CLI: npm run deploy -- group-07
GROUP_CLI="${1:-}"
GROUP="${GROUP_CLI:-${GROUP:-}}"

# Token: prefer KOYEB_TOKEN from env file or global 'koyeb login'. If neither, prompt once.
if [[ -z "${KOYEB_TOKEN:-}" ]]; then
  if ! koyeb account >/dev/null 2>&1; then
    read -r -p "Paste your Koyeb access token (or press Enter if you already did 'koyeb login --token ...'): " INPUT_TOKEN
    if [[ -n "${INPUT_TOKEN}" ]]; then
      export KOYEB_TOKEN="$INPUT_TOKEN"
      set_env "KOYEB_TOKEN" "$KOYEB_TOKEN"
    fi
  fi
fi

# Guard: require GROUP; prompt if missing or placeholder
if [[ -z "${GROUP:-}" ]] || [[ "$(lower "${GROUP:-}")" == "no-group" ]]; then
  echo "ℹ️  GROUP is not set or is 'no-group'."
  read -r -p "Choose your group/service name (e.g., group-01): " GROUP_INPUT
  GROUP="${GROUP_INPUT:-}"
fi

# Fail if still empty or placeholder
if [[ -z "${GROUP:-}" ]] || [[ "$(lower "$GROUP")" == "no-group" ]]; then
  echo "❌ GROUP is set to the placeholder 'no-group' (or empty)."
  echo "   Set a valid value in $ENV_FILE (e.g., GROUP=group-01) or run:"
  echo "     npm run deploy -- group-01"
  exit 1
fi

# Optional pattern hint (non-blocking)
if ! [[ "$GROUP" =~ ^group-[0-9]{2}$ ]]; then
  echo "⚠️  '$GROUP' doesn’t match the 'group-01' pattern. Continuing..."
fi

# Persist GROUP for next time
set_env "GROUP" "$GROUP"

# Final token check (either env-file token or prior 'koyeb login' must exist)
if [[ -z "${KOYEB_TOKEN:-}" ]]; then
  if ! koyeb account >/dev/null 2>&1; then
    echo "❌ No KOYEB_TOKEN set and not logged in. Run 'koyeb login --token <TOKEN>' or add KOYEB_TOKEN to $ENV_FILE."
    exit 1
  fi
fi

echo "🚀 Deploying service '$GROUP' to app '$APP'..."

# Deploy/update the service:
# - GROUP_ID is auto-set from the service name via {{KOYEB_SERVICE_NAME}}
# - FUNCTION_BASE_URL and MCP_SA_JSON are pulled from org secrets
koyeb deploy . "$APP/$GROUP" \
  --type web \
  --ports 3000:http --routes /:3000 \
  --env PORT=3000 \
  --env GROUP_ID={{KOYEB_SERVICE_NAME}} \
  --env FUNCTION_BASE_URL={{secret.FUNCTION_BASE_URL}} \
  --env GCP_SA_JSON={{secret.MCP_SA_JSON}}

echo ""
echo "✅ Deployed '$GROUP' to Koyeb app '$APP'."
echo "ℹ️  Next time, just run: npm run deploy"
