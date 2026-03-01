#!/bin/sh
# Startup script for the voter-engagement container.
# Priority: get the server responding to health checks ASAP.
#
# Order:
#   1. Database migrations (fail-fast — broken schema = don't start)
#   2. Seed data (warn-only)
#   3. Start server (so health checks pass immediately)
#   4. Download voter data in background (non-blocking)

# ── Database migrations (fail-fast — do NOT start server with broken schema) ──
echo "[startup] Running database migrations..."
node node_modules/node-pg-migrate/bin/node-pg-migrate up \
  --database-url-var DATABASE_URL \
  --migrations-dir /app/migrations \
  --no-lock
MIGRATE_EXIT=$?

if [ $MIGRATE_EXIT -ne 0 ]; then
  echo "[startup] ERROR: Database migrations failed (exit code: $MIGRATE_EXIT)"
  exit 1
fi
echo "[startup] Migrations complete."

# ── Seed data (warn-only — server can start without seed data) ──
echo "[startup] Running seed script..."
node /app/scripts/seed.mjs
SEED_EXIT=$?

if [ $SEED_EXIT -ne 0 ]; then
  echo "[startup] WARNING: Seed script failed (exit code: $SEED_EXIT)"
  echo "[startup] Server will start anyway (seed data may be missing)."
fi

# ── Download voter data in background AFTER server starts ──
# This way the server responds to health checks immediately while
# the (potentially slow) voter file download happens asynchronously.
download_voter_data() {
  DATA_DIR="${DATA_DIR:-/app/data}"
  VOTER_FILE="$DATA_DIR/mecklenburg-voters-geo.json"
  DOWNLOAD_URL="https://github.com/blakereinken101/voter-engagement/releases/download/v1.0.0-data/mecklenburg-voters-geo.json.gz"

  echo "[voter-data] Checking for voter file at $VOTER_FILE..."

  if [ -f "$VOTER_FILE" ]; then
    FILE_SIZE=$(wc -c < "$VOTER_FILE" | tr -d ' ')
    echo "[voter-data] Found voter file ($FILE_SIZE bytes)"
    return 0
  fi

  echo "[voter-data] Voter file not found. Downloading from GitHub release..."

  curl -L -s -o "$VOTER_FILE.gz" "$DOWNLOAD_URL"
  DL_EXIT=$?

  if [ $DL_EXIT -ne 0 ]; then
    echo "[voter-data] ERROR: Download failed (exit code: $DL_EXIT)"
    echo "[voter-data] Server running without voter data (will use mock data)."
    return 1
  fi

  DOWNLOAD_SIZE=$(wc -c < "$VOTER_FILE.gz" | tr -d ' ')
  echo "[voter-data] Downloaded $DOWNLOAD_SIZE bytes. Decompressing..."

  gunzip -f "$VOTER_FILE.gz"
  GUNZIP_EXIT=$?

  if [ $GUNZIP_EXIT -ne 0 ]; then
    echo "[voter-data] ERROR: Decompression failed (exit code: $GUNZIP_EXIT)"
    rm -f "$VOTER_FILE.gz"
    echo "[voter-data] Server running without voter data (will use mock data)."
    return 1
  fi

  FINAL_SIZE=$(wc -c < "$VOTER_FILE" | tr -d ' ')
  echo "[voter-data] Voter file ready ($FINAL_SIZE bytes)"
}

# Start voter data download in background (non-blocking)
download_voter_data &

# ── Start the server (health checks can respond immediately) ──
echo "[startup] Starting server..."
exec node server.js
