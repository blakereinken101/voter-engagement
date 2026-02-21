import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const dataDir = path.join(process.cwd(), 'data')
  const dbPath = path.join(dataDir, 'votecircle.db')
  const voterPath = path.join(dataDir, 'mecklenburg-voters-geo.json')
  const voterFallback = path.join(dataDir, 'mecklenburg-voters.json')

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: fs.existsSync(dbPath) ? 'ok' : 'missing',
      voterFile: fs.existsSync(voterPath)
        ? 'geo'
        : fs.existsSync(voterFallback)
          ? 'original'
          : 'missing',
      dataDir: fs.existsSync(dataDir) ? 'ok' : 'missing',
    },
  })
}
