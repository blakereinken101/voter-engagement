import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { getTextingContext, normalizeToE164, mapOptOutRow } from '@/lib/texting'
import { handleAuthError } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTextingContext()
    const pool = getPool()
    const url = new URL(request.url)
    const search = url.searchParams.get('search')
    const page = parseInt(url.searchParams.get('page') || '1', 10)
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200)
    const offset = (page - 1) * limit

    let where = 'WHERE organization_id = $1'
    const values: unknown[] = [ctx.organizationId]
    let idx = 2

    if (search) {
      where += ` AND phone LIKE $${idx++}`
      values.push(`%${search}%`)
    }

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM text_opt_outs ${where}`, values
    )
    const total = parseInt(countRows[0].count, 10)

    values.push(limit, offset)
    const { rows } = await pool.query(
      `SELECT * FROM text_opt_outs ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`,
      values
    )

    return NextResponse.json({
      optOuts: rows.map(mapOptOutRow),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTextingContext()
    const body = await request.json()
    const { phone, reason } = body

    if (!phone?.trim()) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    const normalized = normalizeToE164(phone)
    if (!normalized) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    const pool = getPool()
    await pool.query(
      `INSERT INTO text_opt_outs (id, organization_id, phone, reason, source)
       VALUES ($1, $2, $3, $4, 'manual')
       ON CONFLICT (organization_id, phone) DO NOTHING`,
      [crypto.randomUUID(), ctx.organizationId, normalized, reason?.trim() || null]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
