#!/bin/sh
# Download and decompress voter data if not already present on the volume.
# Runs at container startup before the Next.js server starts.

DATA_DIR="${DATA_DIR:-/app/data}"
VOTER_FILE="$DATA_DIR/mecklenburg-voters-geo.json"
DOWNLOAD_URL="https://github.com/blakereinken101/voter-engagement/releases/download/v1.0.0-data/mecklenburg-voters-geo.json.gz"

if [ -f "$VOTER_FILE" ]; then
  echo "[voter-data] Found voter file at $VOTER_FILE ($(wc -c < "$VOTER_FILE") bytes)"
else
  echo "[voter-data] Voter file not found. Downloading from GitHub release..."
  wget -q -O "$VOTER_FILE.gz" "$DOWNLOAD_URL"

  if [ $? -ne 0 ]; then
    echo "[voter-data] ERROR: Download failed!"
    exit 1
  fi

  echo "[voter-data] Downloaded. Decompressing..."
  gunzip "$VOTER_FILE.gz"

  if [ $? -ne 0 ]; then
    echo "[voter-data] ERROR: Decompression failed!"
    exit 1
  fi

  echo "[voter-data] Voter file ready at $VOTER_FILE ($(wc -c < "$VOTER_FILE") bytes)"
fi

# Start the Next.js server
exec node server.js
