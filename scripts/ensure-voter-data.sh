#!/bin/sh
# Download and decompress voter data if not already present on the volume.
# Runs at container startup before the Next.js server starts.

DATA_DIR="${DATA_DIR:-/app/data}"
VOTER_FILE="$DATA_DIR/mecklenburg-voters-geo.json"
DOWNLOAD_URL="https://github.com/blakereinken101/voter-engagement/releases/download/v1.0.0-data/mecklenburg-voters-geo.json.gz"

echo "[voter-data] Checking for voter file at $VOTER_FILE..."

if [ -f "$VOTER_FILE" ]; then
  FILE_SIZE=$(wc -c < "$VOTER_FILE" | tr -d ' ')
  echo "[voter-data] Found voter file ($FILE_SIZE bytes)"
else
  echo "[voter-data] Voter file not found. Downloading from GitHub release..."

  curl -L -s -o "$VOTER_FILE.gz" "$DOWNLOAD_URL"
  DL_EXIT=$?

  if [ $DL_EXIT -ne 0 ]; then
    echo "[voter-data] ERROR: Download failed (exit code: $DL_EXIT)"
    echo "[voter-data] Starting without voter data (will use mock data)."
    exec node server.js
  fi

  DOWNLOAD_SIZE=$(wc -c < "$VOTER_FILE.gz" | tr -d ' ')
  echo "[voter-data] Downloaded $DOWNLOAD_SIZE bytes. Decompressing..."

  gunzip -f "$VOTER_FILE.gz"
  GUNZIP_EXIT=$?

  if [ $GUNZIP_EXIT -ne 0 ]; then
    echo "[voter-data] ERROR: Decompression failed (exit code: $GUNZIP_EXIT)"
    rm -f "$VOTER_FILE.gz"
    echo "[voter-data] Starting without voter data (will use mock data)."
    exec node server.js
  fi

  FINAL_SIZE=$(wc -c < "$VOTER_FILE" | tr -d ' ')
  echo "[voter-data] Voter file ready ($FINAL_SIZE bytes)"
fi

echo "[voter-data] Starting server..."
exec node server.js
