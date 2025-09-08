#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".koyeb.env"

echo "🔧 Koyeb setup (writes $ENV_FILE for quick future deploys)"

# Ensure CLI
if ! command -v koyeb >/dev/null 2>&1; then
  echo "❌ Koyeb CLI not found. Install first: brew install koyeb/tap/koyeb"
  exit 1
fi

# Token
read -r -p "Paste your Koyeb access token: " TOKEN
if [[ -z "${TOKEN}" ]]; then
  echo "❌ No token provided."
  exit 1
fi

# Group
read -r -p "Choose your group/service name (e.g., group-01): " GROUP
if [[ -z "${GROUP}" ]]; then
  echo "❌ No group provided."
  exit 1
fi

cat > "$ENV_FILE" <<EOF
KOYEB_TOKEN=${TOKEN}
GROUP=${GROUP}
EOF

echo "✅ Wrote $ENV_FILE"
echo "Next: npm run deploy"
