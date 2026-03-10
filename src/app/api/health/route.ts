import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import fs from 'fs'
import path from 'path'

export async function GET() {
  // Do NOT return 503 during shutdown — Railway handles traffic draining.
  // If the old container fails its health check before the new one is ready,
  // both containers are "unhealthy" simultaneously and the site goes down.

  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data')
  const voterPath = path.join(dataDir, 'mecklenburg-voters-geo.json')
  const voterFallback = path.join(dataDir, 'mecklenburg-voters.json')

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

  // Always return 200 — this is a liveness probe, not a readiness probe.
  // Railway just needs to know the process is alive and serving HTTP.
  // DB status is reported in the body for debugging, not via HTTP status.
  const httpStatus = 200

  return NextResponse.json({
    status: healthy ? 'ok' : 'degraded',
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
