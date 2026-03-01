import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import fs from 'fs'
import path from 'path'

export async function GET() {
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

  return NextResponse.json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
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
  })
}
