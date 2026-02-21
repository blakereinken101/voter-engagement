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
    await getPool().query('SELECT 1')
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
