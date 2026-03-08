import { NextRequest, NextResponse } from 'next/server'
import { getSupportContext, requireSupportAdmin } from '@/lib/support-context'
import { handleAuthError } from '@/lib/auth'
import { listArticles, createArticle } from '@/lib/support-kb'

/** GET /api/support/kb — List KB articles */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getSupportContext()
    const url = new URL(request.url)
    const category = url.searchParams.get('category') || undefined
    const search = url.searchParams.get('search') || undefined
    const publishedOnly = url.searchParams.get('published') !== 'false'

    const articles = await listArticles({
      campaignId: ctx.campaignId,
      category,
      search,
      publishedOnly: !ctx.isPlatformAdmin && publishedOnly,
    })

    return NextResponse.json({ articles })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

/** POST /api/support/kb — Create KB article (admin only) */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getSupportContext()
    requireSupportAdmin(ctx)

    const body = await request.json()
    const { title, content, category, tags, isPublished } = body

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'Title and content are required' }, { status: 400 })
    }

    const article = await createArticle({
      campaignId: ctx.campaignId,
      title: title.trim(),
      content: content.trim(),
      category: category || 'general',
      tags: Array.isArray(tags) ? tags : [],
      isPublished: isPublished !== false,
      createdBy: ctx.userId,
    })

    return NextResponse.json({ article }, { status: 201 })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
