#!/usr/bin/env bash
# EAS Build hook: runs before npm install.
# Decodes file-based secrets stored as base64 environment variables.

set -euo pipefail

if [[ -n "${GOOGLE_SERVICES_JSON:-}" ]]; then
  echo "$GOOGLE_SERVICES_JSON" | base64 --decode > ./google-services.json

  if ! python3 -c "import json, sys; json.load(open(sys.argv[1]))" ./google-services.json 2>/dev/null; then
    echo "ERROR: google-services.json is not valid JSON. Check the GOOGLE_SERVICES_JSON secret." >&2
    rm -f ./google-services.json
    exit 1
  fi

  echo "google-services.json written from EAS secret."
fi
