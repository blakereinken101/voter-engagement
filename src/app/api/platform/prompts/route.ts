import { NextRequest, NextResponse } from 'next/server'
import { requirePlatformAdmin, handleAuthError } from '@/lib/platform-guard'
import {
  getAllPromptSections,
  getPromptSection,
  updatePromptSection,
  resetPromptSection,
  getDefaultTemplate,
  PROMPT_SECTIONS,
  CAMPAIGN_TYPES,
  type PromptSectionId,
  type CampaignType,
} from '@/lib/ai-prompts'

export async function GET(request: NextRequest) {
  try {
    const user = await requirePlatformAdmin()

    const campaignType = request.nextUrl.searchParams.get('campaignType') as CampaignType | null
    if (campaignType && !CAMPAIGN_TYPES.includes(campaignType)) {
      return NextResponse.json({ error: 'Invalid campaignType' }, { status: 400 })
    }

    const sections = await getAllPromptSections(campaignType)

    return NextResponse.json({
      sections,
      campaignType: campaignType || null,
      availableCampaignTypes: CAMPAIGN_TYPES,
    })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requirePlatformAdmin()
    const body = await request.json()

    const { sectionId, content, campaignType } = body

    if (!sectionId || !PROMPT_SECTIONS.includes(sectionId)) {
      return NextResponse.json({ error: 'Invalid sectionId' }, { status: 400 })
    }
    if (typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json({ error: 'content is required and must be non-empty' }, { status: 400 })
    }
    if (campaignType && !CAMPAIGN_TYPES.includes(campaignType)) {
      return NextResponse.json({ error: 'Invalid campaignType' }, { status: 400 })
    }

    const section = await updatePromptSection(
      sectionId as PromptSectionId,
      content,
      campaignType || null,
      (user as { id?: string }).id,
    )

    return NextResponse.json({ section })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requirePlatformAdmin()
    const body = await request.json()

    const { sectionId, campaignType } = body

    if (!sectionId || !PROMPT_SECTIONS.includes(sectionId)) {
      return NextResponse.json({ error: 'Invalid sectionId' }, { status: 400 })
    }
    if (campaignType && !CAMPAIGN_TYPES.includes(campaignType)) {
      return NextResponse.json({ error: 'Invalid campaignType' }, { status: 400 })
    }

    await resetPromptSection(sectionId as PromptSectionId, campaignType || null)

    const defaultContent = getDefaultTemplate(sectionId as PromptSectionId)
    return NextResponse.json({ reset: true, defaultContent })
  } catch (error) {
    const { error: msg, status } = handleAuthError(error)
    return NextResponse.json({ error: msg }, { status })
  }
}
