import { NextResponse } from 'next/server'
import { getPool, isShuttingDown } from '@/lib/db'
import fs from 'fs'
import path from 'path'

// Track server start time for startup grace period.
// During the first 45s, return 200 even if the DB isn't ready yet —
// this gives the old container time to release its connections and
// the new pool time to warm up. Railway calls this a "startup probe"
// (Kubernetes has it natively; we emulate it here).
const SERVER_START = Date.now()
const STARTUP_GRACE_MS = 45_000

export async function GET() {
  // During graceful shutdown, tell Railway to stop routing traffic here
  if (isShuttingDown()) {
    return NextResponse.json(
      { status: 'shutting_down', timestamp: new Date().toISOString() },
      { status: 503 }
    )
  }

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data')
  const voterPath = path.join(dataDir, 'mecklenburg-voters-geo.json')
  const voterFallback = path.join(dataDir, 'mecklenburg-voters.json')
  const inStartupGrace = Date.now() - SERVER_START < STARTUP_GRACE_MS

  let dbStatus = 'ok'
  try {
    // Test both read AND write capability — a SELECT-only check misses
    // permission issues that would break login and all write operations.
    await getPool().query(`
      INSERT INTO platform_settings (key, value, updated_at)
      VALUES ('_health_check', 'ok', NOW())
      ON CONFLICT (key) DO UPDATE SET value = 'ok', updated_at = NOW()
    `)
  } catch {
    dbStatus = 'error'
  }

  const healthy = dbStatus === 'ok'

  // During startup grace: always return 200 so Railway marks us healthy
  // and starts draining the old container (freeing DB connections).
  // After grace period: strict mode — 503 if DB is down.
  const httpStatus = healthy ? 200 : inStartupGrace ? 200 : 503

  return NextResponse.json({
    status: healthy ? 'ok' : inStartupGrace ? 'starting' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: dbStatus,
      voterFile: fs.existsSync(voterPath)
        ? 'geo'
        : fs.existsSync(voterFallback)
          ? 'original'
          : 'missing',
      dataDir: fs.existsSync(dataDir) ? 'ok' : 'missing',
    },
  }, { status: httpStatus })
}
