#!/usr/bin/env bash
# Push the web app's server env vars from web/.env.local into Vercel (production
# + preview + development). Run from the repo root AFTER `vercel link`.
#
#   bash scripts/vercel-env-push.sh
#
# Skips EXPO_* (those belong to the mobile app, not the web deploy) and comments.
set -euo pipefail

ENV_FILE="web/.env.local"
[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE"; exit 1; }
command -v vercel >/dev/null || { echo "Install the Vercel CLI first: npm i -g vercel"; exit 1; }

# Keys the web app actually needs at runtime.
KEYS=(
  OPENAI_API_KEY
  GEMINI_API_KEY
  GEMINI_API_KEY_FALLBACK
  ANTHROPIC_API_KEY
  PRICING_MODEL
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  RESEND_API_KEY
  WAITLIST_FROM_EMAIL
  ALERT_EMAIL
)

for key in "${KEYS[@]}"; do
  # Read the raw value (everything after the first =) without shell expansion.
  value="$(grep -E "^${key}=" "$ENV_FILE" | head -1 | cut -d= -f2-)"
  if [ -z "$value" ]; then
    echo "skip  $key (not set in $ENV_FILE)"
    continue
  fi
  for target in production preview development; do
    # Remove any existing value first so re-runs don't error.
    vercel env rm "$key" "$target" --yes >/dev/null 2>&1 || true
    printf '%s' "$value" | vercel env add "$key" "$target" >/dev/null
  done
  echo "set   $key (production, preview, development)"
done

echo "Done. Redeploy to apply: vercel --prod"
