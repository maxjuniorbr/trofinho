#!/usr/bin/env bash
# EAS Build hook: runs before npm install.
# Decodes file-based secrets stored as base64 environment variables.

set -euo pipefail

if [[ -n "${GOOGLE_SERVICES_JSON:-}" ]]; then
  echo "$GOOGLE_SERVICES_JSON" | base64 --decode > ./google-services.json
  echo "google-services.json written from EAS secret."
fi
