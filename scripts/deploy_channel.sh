#!/usr/bin/env bash
set -euo pipefail

# Configuration
MIRTH_HOST="${MIRTH_HOST:-localhost}"
MIRTH_PORT="${MIRTH_PORT:-8443}"
MIRTH_USER="${MIRTH_USER:-admin}"
MIRTH_PASS="${MIRTH_PASS:-admin}"
CHANNEL_FILE="mirth_channels/HL7_Inbound_ADT_To_Postgres.xml"

echo "==> Verifying channel XML file exists..."
if [ ! -f "$CHANNEL_FILE" ]; then
  echo "Error: Channel XML file not found at $CHANNEL_FILE"
  exit 1
fi

echo "==> Waiting for Mirth Connect API to be available on port ${MIRTH_PORT}..."
until curl -k -s "https://${MIRTH_HOST}:${MIRTH_PORT}/api/server/status" > /dev/null; do
  sleep 5
  echo "Waiting for Mirth engine..."
done

echo "==> Authenticating and Importing Channel into Mirth..."
# Import channel XML via Mirth REST API
curl -k -u "${MIRTH_USER}:${MIRTH_PASS}" \
  -H "X-Requested-With: OpenAPI" \
  -H "Content-Type: application/xml" \
  -X POST "https://${MIRTH_HOST}:${MIRTH_PORT}/api/channels" \
  --data-binary "@${CHANNEL_FILE}"

echo "==> Deploying Channel..."
# Retrieve Channel ID from XML and trigger deployment
CHANNEL_ID=$(grep -oPm1 "(?<=<id>)[^<]+" "$CHANNEL_FILE")

curl -k -u "${MIRTH_USER}:${MIRTH_PASS}" \
  -H "X-Requested-With: OpenAPI" \
  -X POST "https://${MIRTH_HOST}:${MIRTH_PORT}/api/channels/${CHANNEL_ID}/_deploy"

echo "==> Channel ${CHANNEL_ID} successfully imported and deployed!"