#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".koyeb.env"

# -------------------------
# Portable KEY=VALUE writer
# -------------------------
set_env() {
  local key="$1" val="$2"
  [[ -f "$ENV_FILE" ]] || touch "$ENV_FILE"
  # Replace existing key or append new one (no sed -i; portable on macOS/Linux)
  local tmp
  tmp="$(mktemp)"
  awk -v k="$key" -v v="$val" -F= '
    BEGIN{OFS="="; found=0}
    $1==k { print k, v; found=1; next }
    { print }
    END{ if (!found) print k, v }
  ' "$ENV_FILE" > "$tmp"
  mv "$tmp" "$ENV_FILE"
}

lower() { printf '%s' "$1" | tr '[:upper:]' '[:lower:]'; }

ensure_cli() {
  if ! command -v koyeb >/dev/null 2>&1; then
    echo "❌ Koyeb CLI not found. Install first: brew install koyeb/tap/koyeb"
    exit 1
  fi
}

echo "🔧 Koyeb one-time setup (writes $ENV_FILE for quick future deploys)"
ensure_cli

# Load existing values if present
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

# --- Token (required) ---
if [[ -z "${KOYEB_TOKEN:-}" ]]; then
  echo "Enter your Koyeb access token (input hidden):"
  read -r -s -p "> " TOKEN
  echo
  if [[ -z "${TOKEN}" ]]; then
    echo "❌ No token provided."
    exit 1
  fi
  export KOYEB_TOKEN="$TOKEN"
  set_env "KOYEB_TOKEN" "$KOYEB_TOKEN"
fi

# Optional sanity check (will succeed if token is valid or you already ran 'koyeb login')
if ! koyeb account >/dev/null 2>&1; then
  echo "⚠️  Could not validate token via 'koyeb account'. Continuing, but deploy may fail if token is invalid."
fi

# --- Group (must not be 'no-group' or empty) ---
GROUP_VALUE="${GROUP:-}"
while true; do
  if [[ -z "$GROUP_VALUE" ]] || [[ "$(lower "$GROUP_VALUE")" == "no-group" ]]; then
    echo "Choose your group/service name (e.g., group-01):"
    read -r -p "> " GROUP_VALUE
  fi
  if [[ -z "$GROUP_VALUE" ]] || [[ "$(lower "$GROUP_VALUE")" == "no-group" ]]; then
    echo "❌ Group cannot be empty or 'no-group'. Try again."
    continue
  fi
  # Optional pattern hint; do not block if it doesn't match
  if ! [[ "$GROUP_VALUE" =~ ^group-[0-9]{2}$ ]]; then
    echo "⚠️  '$GROUP_VALUE' doesn’t match the 'group-01' pattern. Using it anyway."
  fi
  break
done
set_env "GROUP" "$GROUP_VALUE"

echo ""
echo "✅ Saved:"
echo "   - KOYEB_TOKEN (hidden) to $ENV_FILE"
echo "   - GROUP=$GROUP_VALUE to $ENV_FILE"
echo "Next: run 'npm run deploy' to deploy your service."
