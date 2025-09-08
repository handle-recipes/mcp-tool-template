#!/usr/bin/env bash
set -euo pipefail

APP="bekk-flyt-mcp"
ENV_FILE=".koyeb.env"

# ---------- helpers ----------
lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

set_env() {
  local key="$1" val="$2"
  [[ -f "$ENV_FILE" ]] || touch "$ENV_FILE"
  local tmp; tmp="$(mktemp)"
  awk -v k="$key" -v v="$val" -F= '
    BEGIN{OFS="="; found=0}
    $1==k { print k, v; found=1; next }
    { print }
    END{ if (!found) print k, v }
  ' "$ENV_FILE" > "$tmp"
  mv "$tmp" "$ENV_FILE"
}

need_cli() {
  if ! command -v koyeb >/dev/null 2>&1; then
    echo "❌ Koyeb CLI not found. Install: brew install koyeb/tap/koyeb"
    exit 1
  fi
}

# ---------- main ----------
need_cli

# Load env if present
[[ -f "$ENV_FILE" ]] && source "$ENV_FILE"

# Allow override via CLI: npm run deploy -- group-07
GROUP_CLI="${1:-}"
GROUP="${GROUP_CLI:-${GROUP:-}}"

# Token: prefer KOYEB_TOKEN or prior 'koyeb login'
if [[ -z "${KOYEB_TOKEN:-}" ]]; then
  if ! koyeb account >/dev/null 2>&1; then
    echo "Enter your Koyeb access token (input hidden):"
    read -r -s -p "> " TOKEN; echo
    if [[ -n "$TOKEN" ]]; then
      export KOYEB_TOKEN="$TOKEN"
      set_env "KOYEB_TOKEN" "$KOYEB_TOKEN"
    fi
  fi
fi

# Guard: GROUP must not be 'no-group' or empty
if [[ -z "${GROUP:-}" ]] || [[ "$(lower "${GROUP:-}")" == "no-group" ]]; then
  echo "ℹ️  GROUP not set or is 'no-group'. Choose your group (e.g., group-01):"
  read -r -p "> " GROUP
fi
if [[ -z "${GROUP:-}" ]] || [[ "$(lower "$GROUP")" == "no-group" ]]; then
  echo "❌ GROUP is 'no-group' (or empty). Set GROUP=group-01 in $ENV_FILE or run: npm run deploy -- group-01"
  exit 1
fi
set_env "GROUP" "$GROUP"

echo "🚀 Deploying '$GROUP' to app '$APP' (builder: docker)"

# Force Dockerfile builder
koyeb deploy . "$APP/$GROUP" \
  --archive-builder docker \
  --type web \
  --ports 3000:http --routes /:3000 \
  --env PORT=3000 \
  --env GROUP_ID={{KOYEB_SERVICE_NAME}} \
  --env FUNCTION_BASE_URL={{secret.FUNCTION_BASE_URL}} \
  --env GCP_SA_JSON={{secret.MCP_SA_JSON}}

echo
echo "✅ Deployed '$GROUP' to '$APP'."
echo "ℹ️  Build logs: koyeb service logs $APP/$GROUP --type build"
