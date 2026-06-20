#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
FAIL=0

if git ls-files .env .env.local .env.development .env.staging .env.production 2>/dev/null | grep -q .; then
  echo "::error::Tracked .env file — remove from git"
  FAIL=1
fi

if git grep -nE 'sk_live_[a-zA-Z0-9]{10,}|whsec_[a-zA-Z0-9]{20,}|BEGIN PRIVATE KEY' -- . ':!*.example' ':!docs/' 2>/dev/null; then
  echo "::error::Possible secret in tracked file"
  FAIL=1
fi

# Real-looking Firebase API keys (AIza + 30+ chars) — allow REPLACE_ME
if git grep -nE 'AIzaSy[a-zA-Z0-9_-]{30,}' -- . ':!*.example' 2>/dev/null; then
  echo "::error::Possible real Firebase API key committed"
  FAIL=1
fi

[[ "$FAIL" -eq 0 ]] && echo "Secret scan passed." || exit 1
