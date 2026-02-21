import { NextResponse } from 'next/server'
import { getDb, logActivity } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export async function GET() {
  try {
    const session = getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const db = await getDb()

    const { rows: userRows } = await db.query(
      'SELECT role FROM users WHERE id = $1',
      [session.userId]
    )
    if (!userRows.length || userRows[0].role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { rows: activityRows } = await db.query('SELECT COUNT(*) as c FROM activity_log')
    const { rows: actionRows } = await db.query('SELECT COUNT(*) as c FROM action_items')
    const { rows: matchRows } = await db.query('SELECT COUNT(*) as c FROM match_results')
    const { rows: contactRows } = await db.query('SELECT COUNT(*) as c FROM contacts')
    const { rows: userCountRows } = await db.query("SELECT COUNT(*) as c FROM users WHERE role != 'admin'")

    return NextResponse.json({
      activity_log: parseInt(activityRows[0].c),
      action_items: parseInt(actionRows[0].c),
      match_results: parseInt(matchRows[0].c),
      contacts: parseInt(contactRows[0].c),
      users: parseInt(userCountRows[0].c),
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = getSessionFromRequest()
    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const db = await getDb()

    const { rows: userRows } = await db.query(
      'SELECT role FROM users WHERE id = $1',
      [session.userId]
    )
    if (!userRows.length || userRows[0].role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    if (body.confirm !== true) {
      return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })
    }

    // Delete all data in order to respect foreign key constraints
    await db.query('DELETE FROM activity_log')
    await db.query('DELETE FROM action_items')
    await db.query('DELETE FROM match_results')
    await db.query('DELETE FROM contacts')
    await db.query("DELETE FROM users WHERE role != 'admin'")

    // Log the purge action
    await logActivity(session.userId, 'data_purge', { deletedBy: session.userId })

    return NextResponse.json({
      success: true,
      message: 'All campaign data purged. Admin accounts preserved.',
    })
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
