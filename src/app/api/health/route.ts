import { NextResponse } from 'next/server'
import { getPool, isShuttingDown } from '@/lib/db'
import fs from 'fs'
import path from 'path'

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

  // Strict health check: only return 200 when the DB is genuinely reachable.
  // Railway's healthcheckTimeout (300s) gives us time for migrations + DB
  // warmup. No grace period — a broken deploy must never pass the check.
  const httpStatus = healthy ? 200 : 503

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
