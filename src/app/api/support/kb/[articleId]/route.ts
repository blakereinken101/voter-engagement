import { NextRequest, NextResponse } from 'next/server'
import { getSupportContext, requireSupportAdmin } from '@/lib/support-context'
import { handleAuthError } from '@/lib/auth'
import { getArticle, updateArticle, deleteArticle, incrementViewCount } from '@/lib/support-kb'

/** GET /api/support/kb/[articleId] — Get single article */
export async function GET(
  _request: NextRequest,
  { params }: { params: { articleId: string } },
) {
  try {
    await getSupportContext()
    const article = await getArticle(params.articleId)
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }

    // Increment view count in background
    incrementViewCount(params.articleId).catch(() => {})

    return NextResponse.json({ article })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

/** PUT /api/support/kb/[articleId] — Update article (admin only) */
export async function PUT(
  request: NextRequest,
  { params }: { params: { articleId: string } },
) {
  try {
    const ctx = await getSupportContext()
    requireSupportAdmin(ctx)

    const body = await request.json()
    const article = await updateArticle(params.articleId, {
      title: body.title,
      content: body.content,
      category: body.category,
      tags: body.tags,
      isPublished: body.isPublished,
      updatedBy: ctx.userId,
    })

    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }
    return NextResponse.json({ article })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

/** DELETE /api/support/kb/[articleId] — Delete article (admin only) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { articleId: string } },
) {
  try {
    const ctx = await getSupportContext()
    requireSupportAdmin(ctx)

    const deleted = await deleteArticle(params.articleId)
    if (!deleted) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
