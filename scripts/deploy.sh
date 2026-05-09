#!/usr/bin/env bash
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="rhai-org-pulse"

cd "$REPO_DIR"

echo "=== Pulling latest code from main ==="
git fetch origin
git checkout main
git pull origin main

echo "=== Installing dependencies ==="
npm install --prefer-offline

echo "=== Restarting app via pm2 ==="
if pm2 describe "$APP_NAME" &>/dev/null; then
  pm2 reload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi

pm2 save

echo "=== Deploy complete ==="
pm2 list
