/**
 * Knowledge Base CRUD and full-text search for support articles.
 * Server-only module — do not import from client components.
 */
import { getPool } from '@/lib/db'
import type { KBArticle } from '@/types'

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 80)
}

function rowToArticle(row: Record<string, unknown>): KBArticle {
  return {
    id: row.id as string,
    campaignId: (row.campaign_id as string) || null,
    title: row.title as string,
    slug: row.slug as string,
    content: row.content as string,
    category: row.category as string,
    tags: (row.tags as string[]) || [],
    isPublished: row.is_published as boolean,
    viewCount: row.view_count as number,
    helpfulCount: row.helpful_count as number,
    notHelpfulCount: row.not_helpful_count as number,
    createdBy: row.created_by as string,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
  }
}

/**
 * Search KB articles using PostgreSQL full-text search.
 * Returns platform-wide (campaign_id IS NULL) + campaign-specific articles.
 */
export async function searchKnowledgeBase(query: string, campaignId: string): Promise<KBArticle[]> {
  const pool = getPool()
  const { rows } = await pool.query(`
    SELECT *,
           ts_rank(search_vector, websearch_to_tsquery('english', $1)) AS rank
    FROM kb_articles
    WHERE is_published = true
      AND (campaign_id = $2 OR campaign_id IS NULL)
      AND search_vector @@ websearch_to_tsquery('english', $1)
    ORDER BY rank DESC
    LIMIT 5
  `, [query, campaignId])
  return rows.map(rowToArticle)
}

/**
 * List KB articles with optional filters.
 */
export async function listArticles(opts: {
  campaignId: string
  category?: string
  search?: string
  publishedOnly?: boolean
}): Promise<KBArticle[]> {
  const pool = getPool()
  const conditions: string[] = ['(campaign_id = $1 OR campaign_id IS NULL)']
  const params: unknown[] = [opts.campaignId]
  let paramIdx = 2

  if (opts.publishedOnly) {
    conditions.push('is_published = true')
  }
  if (opts.category) {
    conditions.push(`category = $${paramIdx}`)
    params.push(opts.category)
    paramIdx++
  }
  if (opts.search) {
    conditions.push(`search_vector @@ websearch_to_tsquery('english', $${paramIdx})`)
    params.push(opts.search)
    paramIdx++
  }

  const { rows } = await pool.query(`
    SELECT * FROM kb_articles
    WHERE ${conditions.join(' AND ')}
    ORDER BY updated_at DESC
  `, params)
  return rows.map(rowToArticle)
}

/**
 * Get a single KB article by ID.
 */
export async function getArticle(articleId: string): Promise<KBArticle | null> {
  const pool = getPool()
  const { rows } = await pool.query('SELECT * FROM kb_articles WHERE id = $1', [articleId])
  return rows.length > 0 ? rowToArticle(rows[0]) : null
}

/**
 * Create a new KB article.
 */
export async function createArticle(data: {
  campaignId: string | null
  title: string
  content: string
  category: string
  tags: string[]
  isPublished: boolean
  createdBy: string
}): Promise<KBArticle> {
  const pool = getPool()
  const id = crypto.randomUUID()
  const slug = slugify(data.title) || id

  const { rows } = await pool.query(`
    INSERT INTO kb_articles (id, campaign_id, title, slug, content, category, tags, is_published, created_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `, [id, data.campaignId, data.title, slug, data.content, data.category, data.tags, data.isPublished, data.createdBy])
  return rowToArticle(rows[0])
}

/**
 * Update an existing KB article.
 */
export async function updateArticle(articleId: string, data: {
  title?: string
  content?: string
  category?: string
  tags?: string[]
  isPublished?: boolean
  updatedBy: string
}): Promise<KBArticle | null> {
  const pool = getPool()
  const sets: string[] = ['updated_at = NOW()', 'updated_by = $2']
  const params: unknown[] = [articleId, data.updatedBy]
  let paramIdx = 3

  if (data.title !== undefined) {
    sets.push(`title = $${paramIdx}`)
    params.push(data.title)
    paramIdx++
    sets.push(`slug = $${paramIdx}`)
    params.push(slugify(data.title) || articleId)
    paramIdx++
  }
  if (data.content !== undefined) {
    sets.push(`content = $${paramIdx}`)
    params.push(data.content)
    paramIdx++
  }
  if (data.category !== undefined) {
    sets.push(`category = $${paramIdx}`)
    params.push(data.category)
    paramIdx++
  }
  if (data.tags !== undefined) {
    sets.push(`tags = $${paramIdx}`)
    params.push(data.tags)
    paramIdx++
  }
  if (data.isPublished !== undefined) {
    sets.push(`is_published = $${paramIdx}`)
    params.push(data.isPublished)
    paramIdx++
  }

  const { rows } = await pool.query(
    `UPDATE kb_articles SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
    params,
  )
  return rows.length > 0 ? rowToArticle(rows[0]) : null
}

/**
 * Delete a KB article.
 */
export async function deleteArticle(articleId: string): Promise<boolean> {
  const pool = getPool()
  const { rowCount } = await pool.query('DELETE FROM kb_articles WHERE id = $1', [articleId])
  return (rowCount ?? 0) > 0
}

/**
 * Increment view count.
 */
export async function incrementViewCount(articleId: string): Promise<void> {
  const pool = getPool()
  await pool.query('UPDATE kb_articles SET view_count = view_count + 1 WHERE id = $1', [articleId])
}

/**
 * Record feedback (helpful / not helpful).
 */
export async function recordFeedback(articleId: string, helpful: boolean): Promise<void> {
  const pool = getPool()
  const column = helpful ? 'helpful_count' : 'not_helpful_count'
  await pool.query(
    `UPDATE kb_articles SET ${column} = ${column} + 1 WHERE id = $1`,
    [articleId],
  )
}
