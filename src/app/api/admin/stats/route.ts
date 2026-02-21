import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET() {
  try {
    requireAdmin()
    const db = await getDb()

    // ── Summary stats ──────────────────────────────────────────────────

    const { rows: volRows } = await db.query("SELECT COUNT(*) as c FROM users WHERE role = 'volunteer'")
    const totalVolunteers = parseInt(volRows[0].c)

    const { rows: contRows } = await db.query('SELECT COUNT(*) as c FROM contacts')
    const totalContacts = parseInt(contRows[0].c)

    const { rows: matchRows } = await db.query("SELECT COUNT(*) as c FROM match_results WHERE status = 'confirmed'")
    const matchedCount = parseInt(matchRows[0].c)

    const { rows: contactedRows } = await db.query('SELECT COUNT(*) as c FROM action_items WHERE contacted = 1')
    const contactedCount = parseInt(contactedRows[0].c)

    const { rows: suppRows } = await db.query("SELECT COUNT(*) as c FROM action_items WHERE contact_outcome = 'supporter'")
    const supportersCount = parseInt(suppRows[0].c)

    // Outcome distribution
    const { rows: outcomes } = await db.query(`
      SELECT contact_outcome, COUNT(*) as c FROM action_items
      WHERE contact_outcome IS NOT NULL GROUP BY contact_outcome
    `)

    const outcomeDistribution: Record<string, number> = {}
    outcomes.forEach((o: { contact_outcome: string; c: string }) => { outcomeDistribution[o.contact_outcome] = parseInt(o.c) })

    // Segment distribution
    const { rows: segments } = await db.query(`
      SELECT segment, COUNT(*) as c FROM match_results
      WHERE segment IS NOT NULL GROUP BY segment
    `)

    const segmentDistribution: Record<string, number> = {}
    segments.forEach((s: { segment: string; c: string }) => { segmentDistribution[s.segment] = parseInt(s.c) })

    // ── Daily activity trend (last 30 days) ────────────────────────────

    // Build a list of the last 30 dates (YYYY-MM-DD)
    const last30Dates: string[] = []
    const now = new Date()
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      last30Dates.push(d.toISOString().slice(0, 10))
    }
    const thirtyDaysAgo = last30Dates[0]

    // Contacts added per day
    const { rows: contactsAddedRows } = await db.query(`
      SELECT DATE(created_at) as day, COUNT(*) as c
      FROM contacts
      WHERE DATE(created_at) >= $1
      GROUP BY DATE(created_at)
    `, [thirtyDaysAgo])

    const contactsAddedMap: Record<string, number> = {}
    contactsAddedRows.forEach((r: { day: string; c: string }) => { contactsAddedMap[r.day] = parseInt(r.c) })

    // Contacts reached per day (contacted_date)
    const { rows: contactsReachedRows } = await db.query(`
      SELECT DATE(contacted_date) as day, COUNT(*) as c
      FROM action_items
      WHERE contacted = 1 AND DATE(contacted_date) >= $1
      GROUP BY DATE(contacted_date)
    `, [thirtyDaysAgo])

    const contactsReachedMap: Record<string, number> = {}
    contactsReachedRows.forEach((r: { day: string; c: string }) => { contactsReachedMap[r.day] = parseInt(r.c) })

    // Supporters gained per day (contacted_date with outcome = 'supporter')
    const { rows: supportersGainedRows } = await db.query(`
      SELECT DATE(contacted_date) as day, COUNT(*) as c
      FROM action_items
      WHERE contact_outcome = 'supporter' AND DATE(contacted_date) >= $1
      GROUP BY DATE(contacted_date)
    `, [thirtyDaysAgo])

    const supportersGainedMap: Record<string, number> = {}
    supportersGainedRows.forEach((r: { day: string; c: string }) => { supportersGainedMap[r.day] = parseInt(r.c) })

    const dailyActivity = last30Dates.map(date => ({
      date,
      contacts_added: contactsAddedMap[date] || 0,
      contacts_reached: contactsReachedMap[date] || 0,
      supporters_gained: supportersGainedMap[date] || 0,
    }))

    // ── Per-volunteer progress ─────────────────────────────────────────

    const { rows: volunteerRows } = await db.query(`
      SELECT
        u.id,
        u.name,
        COUNT(DISTINCT c.id) as contacts,
        COUNT(DISTINCT CASE WHEN mr.status = 'confirmed' THEN mr.id END) as matched,
        COUNT(DISTINCT CASE WHEN ai.contacted = 1 THEN ai.id END) as contacted,
        COUNT(DISTINCT CASE WHEN ai.contact_outcome = 'supporter' THEN ai.id END) as supporters,
        MAX(al.created_at) as "lastActive"
      FROM users u
      LEFT JOIN contacts c ON c.user_id = u.id
      LEFT JOIN match_results mr ON mr.contact_id = c.id
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      LEFT JOIN activity_log al ON al.user_id = u.id
      WHERE u.role = 'volunteer'
      GROUP BY u.id, u.name
      ORDER BY contacts DESC
    `)

    const volunteerProgress = volunteerRows.map((v: {
      id: string
      name: string
      contacts: string
      matched: string
      contacted: string
      supporters: string
      lastActive: string | null
    }) => {
      const contacts = parseInt(v.contacts)
      const contacted = parseInt(v.contacted)
      const supporters = parseInt(v.supporters)
      return {
        id: v.id,
        name: v.name,
        contacts,
        matched: parseInt(v.matched),
        contacted,
        supporters,
        lastActive: v.lastActive,
        contactRate: contacts > 0 ? Math.round((contacted / contacts) * 100) : 0,
        conversionRate: contacted > 0 ? Math.round((supporters / contacted) * 100) : 0,
      }
    })

    // ── Outreach method breakdown ──────────────────────────────────────

    const { rows: methodRows } = await db.query(`
      SELECT outreach_method, COUNT(*) as c
      FROM action_items
      WHERE outreach_method IS NOT NULL AND contacted = 1
      GROUP BY outreach_method
    `)

    const outreachMethods: Record<string, number> = {}
    methodRows.forEach((m: { outreach_method: string; c: string }) => { outreachMethods[m.outreach_method] = parseInt(m.c) })

    // ── Category breakdown ─────────────────────────────────────────────

    const { rows: categoryRows } = await db.query(`
      SELECT
        c.category,
        COUNT(DISTINCT c.id) as total,
        COUNT(DISTINCT CASE WHEN ai.contacted = 1 THEN c.id END) as contacted,
        COUNT(DISTINCT CASE WHEN ai.contact_outcome = 'supporter' THEN c.id END) as supporters
      FROM contacts c
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      GROUP BY c.category
      ORDER BY total DESC
    `)

    const categoryBreakdown = categoryRows.map((r: {
      category: string
      total: string
      contacted: string
      supporters: string
    }) => ({
      category: r.category,
      total: parseInt(r.total),
      contacted: parseInt(r.contacted),
      supporters: parseInt(r.supporters),
    }))

    // ── Recent activity feed (last 20 entries) ─────────────────────────

    const { rows: activityRows } = await db.query(`
      SELECT al.id, u.name as "userName", al.action, al.details, al.created_at as "createdAt"
      FROM activity_log al
      JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC
      LIMIT 20
    `)

    const recentActivity = activityRows.map((r: {
      id: number
      userName: string
      action: string
      details: string | null
      createdAt: string
    }) => ({
      id: r.id,
      userName: r.userName,
      action: r.action,
      details: r.details,
      createdAt: r.createdAt,
    }))

    // ── Goal tracking ──────────────────────────────────────────────────

    const goals = {
      totalContactsGoal: 500,
      totalContactedGoal: 250,
      totalSupportersGoal: 100,
      currentContacts: totalContacts,
      currentContacted: contactedCount,
      currentSupporters: supportersCount,
    }

    // ── Return full response ───────────────────────────────────────────

    return NextResponse.json({
      totalVolunteers,
      totalContacts,
      matchRate: totalContacts > 0 ? matchedCount / totalContacts : 0,
      contactRate: totalContacts > 0 ? contactedCount / totalContacts : 0,
      outcomeDistribution,
      segmentDistribution,
      dailyActivity,
      volunteerProgress,
      outreachMethods,
      categoryBreakdown,
      recentActivity,
      goals,
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error'
    if (msg === 'Admin access required') return NextResponse.json({ error: msg }, { status: 403 })
    if (msg === 'Not authenticated') return NextResponse.json({ error: msg }, { status: 401 })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
