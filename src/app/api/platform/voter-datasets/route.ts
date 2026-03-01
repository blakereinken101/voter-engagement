import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin, handleAuthError } from '@/lib/platform-guard'
import { AuthError } from '@/lib/auth'
import { getPool } from '@/lib/db'
import { normalizeName } from '@/lib/matching'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 min for large uploads

/**
 * GET /api/platform/voter-datasets
 * List all voter datasets with record counts.
 */
export async function GET() {
  try {
    await requirePlatformAdmin()
    const pool = getPool()

    const { rows } = await pool.query(`
      SELECT vd.*,
        (SELECT count(*)::int FROM campaign_voter_datasets cvd WHERE cvd.dataset_id = vd.id) as campaign_count
      FROM voter_datasets vd
      ORDER BY vd.created_at DESC
    `)

    return NextResponse.json({ datasets: rows })
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[platform/voter-datasets] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * POST /api/platform/voter-datasets
 * Upload a new voter dataset (JSON file via multipart/form-data).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requirePlatformAdmin()
    const pool = getPool()

    // Reject oversized requests before parsing the body into memory
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength, 10) > 105 * 1024 * 1024) {
      return NextResponse.json({
        error: 'File too large for web upload (>100MB). Use the CLI instead: npm run import:voters -- --file=path/to/file.json --name="Dataset Name" --state=PA'
      }, { status: 413 })
    }

    const formData = await request.formData()
    const name = formData.get('name') as string
    const state = formData.get('state') as string
    const geographyType = (formData.get('geographyType') as string) || 'state'
    const geographyName = formData.get('geographyName') as string | null
    const file = formData.get('file') as File | null

    if (!name?.trim() || !state?.trim()) {
      return NextResponse.json({ error: 'Name and state are required' }, { status: 400 })
    }

    if (!/^[A-Za-z]{2}$/.test(state.trim())) {
      return NextResponse.json({ error: 'State must be a 2-letter code' }, { status: 400 })
    }

    if (!file) {
      return NextResponse.json({ error: 'JSON file is required' }, { status: 400 })
    }

    // Reject large files — they need the CLI import script
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({
        error: 'File too large for web upload (>100MB). Use the CLI instead: npm run import:voters -- --file=path/to/file.json --name="Dataset Name" --state=PA'
      }, { status: 413 })
    }

    const datasetId = `vds-${crypto.randomUUID().slice(0, 12)}`

    // Create dataset record with processing status
    await pool.query(
      `INSERT INTO voter_datasets (id, name, state, geography_type, geography_name, uploaded_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'processing')`,
      [datasetId, name.trim(), state.trim().toUpperCase(), geographyType, geographyName?.trim() || null, session.userId]
    )

    // Parse and insert voter records
    try {
      const fileText = await file.text()
      const records = JSON.parse(fileText) as Record<string, unknown>[]

      if (!Array.isArray(records) || records.length === 0) {
        await pool.query(`UPDATE voter_datasets SET status = 'error', error_message = 'File contains no records' WHERE id = $1`, [datasetId])
        return NextResponse.json({ error: 'File contains no records' }, { status: 400 })
      }

      // Lazy-load Double Metaphone
      const natural = await import('natural')
      const dm = new natural.DoubleMetaphone()
      const computeMetaphone = (word: string): string => {
        const codes = dm.process(word)
        return codes[0] || ''
      }

      // Batch insert in chunks
      const BATCH_SIZE = 5000
      let inserted = 0

      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE)
        const values: unknown[] = []
        const placeholders: string[] = []
        let paramIdx = 1

        for (const r of batch) {
          const lastName = String(r.last_name || '').trim()
          const lastNameNorm = normalizeName(lastName)
          const lastNameMeta = lastNameNorm ? computeMetaphone(lastNameNorm) : ''

          placeholders.push(
            `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
          )

          values.push(
            datasetId,
            String(r.voter_id || `gen-${i}-${inserted}`),
            String(r.first_name || '').trim(),
            lastName,
            r.date_of_birth || null,
            r.gender || null,
            r.residential_address || null,
            r.city || null,
            r.state || state.trim().toUpperCase(),
            r.zip || null,
            r.party_affiliation || null,
            r.registration_date || null,
            r.voter_status || 'Active',
            r.VH2024G || r.vh2024g || '',
            r.VH2022G || r.vh2022g || '',
            r.VH2020G || r.vh2020g || '',
            r.VH2024P || r.vh2024p || '',
            r.VH2022P || r.vh2022p || '',
            r.VH2020P || r.vh2020p || '',
            r.lat != null ? Number(r.lat) : null,
            r.lng != null ? Number(r.lng) : null,
            lastNameNorm,
            lastNameMeta,
            r.congressional_district || null,
            r.state_senate_district || null,
            r.state_house_district || null,
          )

          inserted++
        }

        await pool.query(
          `INSERT INTO voters (dataset_id, voter_id, first_name, last_name, date_of_birth, gender,
            residential_address, city, state, zip, party_affiliation, registration_date, voter_status,
            vh2024g, vh2022g, vh2020g, vh2024p, vh2022p, vh2020p, lat, lng,
            last_name_normalized, last_name_metaphone,
            congressional_district, state_senate_district, state_house_district)
           VALUES ${placeholders.join(', ')}
           ON CONFLICT (dataset_id, voter_id) DO NOTHING`,
          values
        )

        console.log(`[voter-datasets] Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} (${inserted.toLocaleString()} / ${records.length.toLocaleString()})`)
      }

      // Mark as ready
      await pool.query(
        `UPDATE voter_datasets SET status = 'ready', record_count = $2 WHERE id = $1`,
        [datasetId, inserted]
      )

      console.log(`[voter-datasets] Upload complete: ${inserted.toLocaleString()} records for dataset ${datasetId}`)
      return NextResponse.json({ datasetId, recordCount: inserted, status: 'ready' })
    } catch (parseError) {
      console.error('[voter-datasets] Parse/insert error:', parseError)
      await pool.query(
        `UPDATE voter_datasets SET status = 'error', error_message = $2 WHERE id = $1`,
        [datasetId, String(parseError)]
      )
      return NextResponse.json({ error: 'Failed to parse or insert voter data' }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof AuthError) {
      const { error: msg, status } = handleAuthError(error)
      return NextResponse.json({ error: msg }, { status })
    }
    console.error('[platform/voter-datasets] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
