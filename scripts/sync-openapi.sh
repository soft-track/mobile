#!/usr/bin/env bash
# Refresh the vendored OpenAPI contract.
#
# The schema is produced by the backend in the soft-track/soft-track repo, so it
# has to be vendored here. Sources, in order of preference:
#
#   SOFTTRACK_REPO=/path/to/soft-track   a local checkout (copied verbatim)
#   SOFTTRACK_URL=https://instance       a running instance's /openapi.json
#
# Defaults to a sibling checkout, then to a local backend on :8000.
set -euo pipefail

cd "$(dirname "$0")/.."
DEST="openapi/openapi.json"

REPO="${SOFTTRACK_REPO:-../soft-track}"
URL="${SOFTTRACK_URL:-}"

if [ -n "$URL" ]; then
  echo "Fetching schema from $URL/openapi.json"
  curl -fsS "$URL/openapi.json" -o "$DEST"
elif [ -f "$REPO/backend/openapi.json" ]; then
  echo "Copying schema from $REPO/backend/openapi.json"
  cp "$REPO/backend/openapi.json" "$DEST"
else
  echo "No schema source found." >&2
  echo "Set SOFTTRACK_REPO to a soft-track checkout, or SOFTTRACK_URL to a running instance." >&2
  exit 1
fi

echo "Wrote $DEST"
echo "Now run: npm run generate:api"
