import { NextResponse } from 'next/server'
import { getDb } from '@/lib/db'
import { requireAdmin } from '@/lib/admin-guard'

export async function GET() {
  try {
    requireAdmin()
    const db = getDb()

    // ── Summary stats ──────────────────────────────────────────────────

    const totalVolunteers = (
      db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'volunteer'").get() as { c: number }
    ).c

    const totalContacts = (
      db.prepare('SELECT COUNT(*) as c FROM contacts').get() as { c: number }
    ).c

    const matchedCount = (
      db.prepare("SELECT COUNT(*) as c FROM match_results WHERE status = 'confirmed'").get() as { c: number }
    ).c

    const contactedCount = (
      db.prepare('SELECT COUNT(*) as c FROM action_items WHERE contacted = 1').get() as { c: number }
    ).c

    const supportersCount = (
      db.prepare("SELECT COUNT(*) as c FROM action_items WHERE contact_outcome = 'supporter'").get() as { c: number }
    ).c

    // Outcome distribution
    const outcomes = db.prepare(`
      SELECT contact_outcome, COUNT(*) as c FROM action_items
      WHERE contact_outcome IS NOT NULL GROUP BY contact_outcome
    `).all() as { contact_outcome: string; c: number }[]

    const outcomeDistribution: Record<string, number> = {}
    outcomes.forEach(o => { outcomeDistribution[o.contact_outcome] = o.c })

    // Segment distribution
    const segments = db.prepare(`
      SELECT segment, COUNT(*) as c FROM match_results
      WHERE segment IS NOT NULL GROUP BY segment
    `).all() as { segment: string; c: number }[]

    const segmentDistribution: Record<string, number> = {}
    segments.forEach(s => { segmentDistribution[s.segment] = s.c })

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
    const contactsAddedRows = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as c
      FROM contacts
      WHERE date(created_at) >= ?
      GROUP BY date(created_at)
    `).all(thirtyDaysAgo) as { day: string; c: number }[]

    const contactsAddedMap: Record<string, number> = {}
    contactsAddedRows.forEach(r => { contactsAddedMap[r.day] = r.c })

    // Contacts reached per day (contacted_date)
    const contactsReachedRows = db.prepare(`
      SELECT date(contacted_date) as day, COUNT(*) as c
      FROM action_items
      WHERE contacted = 1 AND date(contacted_date) >= ?
      GROUP BY date(contacted_date)
    `).all(thirtyDaysAgo) as { day: string; c: number }[]

    const contactsReachedMap: Record<string, number> = {}
    contactsReachedRows.forEach(r => { contactsReachedMap[r.day] = r.c })

    // Supporters gained per day (contacted_date with outcome = 'supporter')
    const supportersGainedRows = db.prepare(`
      SELECT date(contacted_date) as day, COUNT(*) as c
      FROM action_items
      WHERE contact_outcome = 'supporter' AND date(contacted_date) >= ?
      GROUP BY date(contacted_date)
    `).all(thirtyDaysAgo) as { day: string; c: number }[]

    const supportersGainedMap: Record<string, number> = {}
    supportersGainedRows.forEach(r => { supportersGainedMap[r.day] = r.c })

    const dailyActivity = last30Dates.map(date => ({
      date,
      contacts_added: contactsAddedMap[date] || 0,
      contacts_reached: contactsReachedMap[date] || 0,
      supporters_gained: supportersGainedMap[date] || 0,
    }))

    // ── Per-volunteer progress ─────────────────────────────────────────

    const volunteerRows = db.prepare(`
      SELECT
        u.id,
        u.name,
        COUNT(DISTINCT c.id) as contacts,
        COUNT(DISTINCT CASE WHEN mr.status = 'confirmed' THEN mr.id END) as matched,
        COUNT(DISTINCT CASE WHEN ai.contacted = 1 THEN ai.id END) as contacted,
        COUNT(DISTINCT CASE WHEN ai.contact_outcome = 'supporter' THEN ai.id END) as supporters,
        MAX(al.created_at) as lastActive
      FROM users u
      LEFT JOIN contacts c ON c.user_id = u.id
      LEFT JOIN match_results mr ON mr.contact_id = c.id
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      LEFT JOIN activity_log al ON al.user_id = u.id
      WHERE u.role = 'volunteer'
      GROUP BY u.id
      ORDER BY contacts DESC
    `).all() as {
      id: string
      name: string
      contacts: number
      matched: number
      contacted: number
      supporters: number
      lastActive: string | null
    }[]

    const volunteerProgress = volunteerRows.map(v => ({
      id: v.id,
      name: v.name,
      contacts: v.contacts,
      matched: v.matched,
      contacted: v.contacted,
      supporters: v.supporters,
      lastActive: v.lastActive,
      contactRate: v.contacts > 0 ? Math.round((v.contacted / v.contacts) * 100) : 0,
      conversionRate: v.contacted > 0 ? Math.round((v.supporters / v.contacted) * 100) : 0,
    }))

    // ── Outreach method breakdown ──────────────────────────────────────

    const methodRows = db.prepare(`
      SELECT outreach_method, COUNT(*) as c
      FROM action_items
      WHERE outreach_method IS NOT NULL AND contacted = 1
      GROUP BY outreach_method
    `).all() as { outreach_method: string; c: number }[]

    const outreachMethods: Record<string, number> = {}
    methodRows.forEach(m => { outreachMethods[m.outreach_method] = m.c })

    // ── Category breakdown ─────────────────────────────────────────────

    const categoryRows = db.prepare(`
      SELECT
        c.category,
        COUNT(DISTINCT c.id) as total,
        COUNT(DISTINCT CASE WHEN ai.contacted = 1 THEN c.id END) as contacted,
        COUNT(DISTINCT CASE WHEN ai.contact_outcome = 'supporter' THEN c.id END) as supporters
      FROM contacts c
      LEFT JOIN action_items ai ON ai.contact_id = c.id
      GROUP BY c.category
      ORDER BY total DESC
    `).all() as {
      category: string
      total: number
      contacted: number
      supporters: number
    }[]

    const categoryBreakdown = categoryRows.map(r => ({
      category: r.category,
      total: r.total,
      contacted: r.contacted,
      supporters: r.supporters,
    }))

    // ── Recent activity feed (last 20 entries) ─────────────────────────

    const activityRows = db.prepare(`
      SELECT al.id, u.name as userName, al.action, al.details, al.created_at as createdAt
      FROM activity_log al
      JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC
      LIMIT 20
    `).all() as {
      id: number
      userName: string
      action: string
      details: string | null
      createdAt: string
    }[]

    const recentActivity = activityRows.map(r => ({
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
