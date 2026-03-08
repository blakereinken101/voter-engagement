/**
 * AI Support Triage — handles the support chat with knowledge base retrieval
 * and escalation to human agents.
 * Server-only module — do not import from client components.
 */
import Anthropic from '@anthropic-ai/sdk'
import { getPool } from '@/lib/db'
import { searchKnowledgeBase } from '@/lib/support-kb'
import { createTicket } from '@/lib/support-tickets'
import { notifyTicketEvent } from '@/lib/support-realtime'
import { sendTicketCreatedNotification } from '@/lib/email'
import type { KBArticle, SupportChatMessage, MembershipRole } from '@/types'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6'

let anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic()
  }
  return anthropicClient
}

// ── Tool Definition ─────────────────────────────────────────────

const SUPPORT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'escalate_to_human',
    description: 'Create a support ticket to connect the user with a human agent. Use when you cannot fully resolve the issue from the knowledge base, or when the user explicitly asks to talk to a person.',
    input_schema: {
      type: 'object' as const,
      properties: {
        subject: { type: 'string', description: 'Brief summary of the issue (under 80 characters)' },
        category: {
          type: 'string',
          enum: ['general', 'technical', 'billing', 'account', 'data', 'feature-request'],
          description: 'Category of the issue',
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high'],
          description: 'Suggested priority based on urgency',
        },
        summary: { type: 'string', description: 'Detailed summary of what the user needs help with, including any relevant context from the conversation' },
      },
      required: ['subject', 'category', 'summary'],
    },
  },
]

// ── System Prompt ───────────────────────────────────────────────

function buildSupportSystemPrompt(
  userName: string,
  userRole: MembershipRole,
  campaignName: string,
  relevantArticles: KBArticle[],
): string {
  const articleContext = relevantArticles.length > 0
    ? relevantArticles.map(a =>
      `### ${a.title}\n${a.content}${a.tags.length > 0 ? `\n_Tags: ${a.tags.join(', ')}_` : ''}`
    ).join('\n\n---\n\n')
    : 'No matching help articles found for this query.'

  return `You are a helpful support assistant for Threshold, a voter engagement platform used by political campaigns.

You are helping **${userName}** (role: ${userRole}) who is part of the **${campaignName}** campaign.

## Your behavior:
- Answer the user's question using the knowledge base articles provided below.
- If the articles fully answer the question, provide a clear, concise answer.
- If you can partially answer but aren't fully confident, share what you know and offer to connect them with a human support agent.
- If you cannot answer from the articles, be honest: say you don't have that information and offer to create a support ticket.
- Never make up information or guess at technical details.
- Be concise, friendly, and helpful.
- Use simple language — many users are campaign volunteers, not tech experts.

## When to escalate:
Use the \`escalate_to_human\` tool when:
1. The user explicitly asks to talk to a human or support agent
2. You cannot answer their question from the knowledge base
3. The issue requires investigation (account problems, data issues, bugs)
4. The user is frustrated or the issue is urgent

When escalating, write a thorough summary so the agent has full context and doesn't need to re-ask.

## Knowledge Base Articles:
${articleContext}`
}

// ── Streaming Chat ──────────────────────────────────────────────

export interface SupportStreamEvent {
  type: 'text' | 'tool_result' | 'error' | 'done'
  text?: string
  ticketId?: string
  ticketSubject?: string
  message?: string
}

/**
 * Stream a support chat response. Searches KB for context, then calls Claude.
 */
export async function* streamSupportChat(opts: {
  userId: string
  campaignId: string
  userName: string
  userRole: MembershipRole
  campaignName: string
  message: string
  history: SupportChatMessage[]
}): AsyncGenerator<SupportStreamEvent> {
  if (!process.env.ANTHROPIC_API_KEY) {
    yield { type: 'error', message: 'AI support is not configured.' }
    return
  }

  // Search knowledge base for relevant articles
  let articles: KBArticle[] = []
  try {
    articles = await searchKnowledgeBase(opts.message, opts.campaignId)
  } catch (err) {
    console.error('[support-ai] KB search error (non-fatal):', err)
  }

  const systemPrompt = buildSupportSystemPrompt(
    opts.userName,
    opts.userRole,
    opts.campaignName,
    articles,
  )

  // Build message history for Anthropic
  const messages: Anthropic.MessageParam[] = []
  for (const msg of opts.history) {
    messages.push({ role: msg.role, content: msg.content })
  }
  messages.push({ role: 'user', content: opts.message })

  const client = getAnthropicClient()

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools: SUPPORT_TOOLS,
      messages,
      stream: true,
    })

    let currentToolUse: { id: string; name: string; input: string } | null = null

    for await (const event of response) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'text') {
          // Text block starting — nothing to do
        } else if (event.content_block.type === 'tool_use') {
          currentToolUse = { id: event.content_block.id, name: event.content_block.name, input: '' }
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          yield { type: 'text', text: event.delta.text }
        } else if (event.delta.type === 'input_json_delta' && currentToolUse) {
          currentToolUse.input += event.delta.partial_json
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolUse && currentToolUse.name === 'escalate_to_human') {
          // Execute the escalation tool
          try {
            const input = JSON.parse(currentToolUse.input) as {
              subject: string
              category: string
              priority?: string
              summary: string
            }

            const ticket = await createTicket({
              campaignId: opts.campaignId,
              userId: opts.userId,
              subject: input.subject,
              category: (input.category || 'general') as 'general' | 'technical' | 'billing' | 'account' | 'data' | 'feature-request',
              priority: (input.priority || 'normal') as 'low' | 'normal' | 'high' | 'urgent',
              aiConversation: [
                ...opts.history,
                { role: 'user' as const, content: opts.message, timestamp: new Date().toISOString() },
              ],
              aiSuggestedCategory: input.category,
              aiSuggestedPriority: input.priority,
            })

            // Notify admins via SSE
            notifyTicketEvent(opts.campaignId, opts.userId, ticket.assignedTo, {
              type: 'ticket_created',
              ticketId: ticket.id,
              subject: ticket.subject,
              category: ticket.category,
              priority: ticket.priority,
            }).catch(err => console.error('[support-ai] SSE notify error:', err))

            // Send email notification to campaign admins (fire-and-forget)
            const pool = (await import('@/lib/db')).getPool()
            pool.query(
              `SELECT u.email FROM users u
               JOIN memberships m ON m.user_id = u.id
               WHERE m.campaign_id = $1 AND m.is_active = true
                 AND m.role IN ('campaign_admin', 'org_owner')
               LIMIT 5`,
              [opts.campaignId],
            ).then(({ rows }) => {
              for (const row of rows) {
                sendTicketCreatedNotification(
                  row.email, ticket.subject, opts.userName,
                  ticket.category, ticket.priority, ticket.id,
                ).catch(() => {})
              }
            }).catch(() => {})

            yield { type: 'tool_result', ticketId: ticket.id, ticketSubject: ticket.subject }
          } catch (err) {
            console.error('[support-ai] Escalation error:', err)
            yield { type: 'error', message: 'Failed to create support ticket. Please try again.' }
          }
          currentToolUse = null
        }
      } else if (event.type === 'message_stop') {
        yield { type: 'done' }
      }
    }
  } catch (err) {
    console.error('[support-ai] Stream error:', err)
    yield { type: 'error', message: 'An error occurred. Please try again.' }
  }
}

// ── AI Suggested Response (for agents) ──────────────────────────

/**
 * Generate an AI-suggested response for a support ticket.
 * Uses a smaller model for cost efficiency.
 */
export async function suggestResponse(opts: {
  ticketSubject: string
  ticketCategory: string
  aiConversation: SupportChatMessage[] | null
  messages: Array<{ senderName: string; content: string; isInternalNote: boolean }>
  campaignId: string
}): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('AI not configured')
  }

  // Search KB for relevant articles
  let articles: KBArticle[] = []
  try {
    articles = await searchKnowledgeBase(opts.ticketSubject, opts.campaignId)
  } catch {
    // Non-fatal
  }

  const articleContext = articles.length > 0
    ? articles.map(a => `### ${a.title}\n${a.content}`).join('\n\n---\n\n')
    : 'No relevant knowledge base articles found.'

  const conversationContext = opts.aiConversation
    ? opts.aiConversation.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n\n')
    : 'No prior AI conversation.'

  const messageThread = opts.messages
    .filter(m => !m.isInternalNote)
    .map(m => `${m.senderName}: ${m.content}`)
    .join('\n\n')

  const client = getAnthropicClient()
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: `You are a support agent for Threshold, a voter engagement platform. Draft a helpful, concise response to the user's support ticket. Use the knowledge base articles and conversation context to inform your response. Write as if you are the support agent replying directly to the user. Be friendly and professional.`,
    messages: [{
      role: 'user',
      content: `## Ticket: ${opts.ticketSubject}
Category: ${opts.ticketCategory}

## Prior AI Conversation:
${conversationContext}

## Ticket Messages:
${messageThread || '(No messages yet)'}

## Relevant Knowledge Base Articles:
${articleContext}

Draft a response to help this user:`,
    }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  return textBlock?.text || 'Unable to generate suggestion.'
}
