'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useAppContext } from '@/context/AppContext'
import { Bot, Send, Trash2, Sparkles } from 'lucide-react'
import ChatMessageBubble from './ChatMessageBubble'
import ChatQuickActions from './ChatQuickActions'
import type { ChatMessage, PersonEntry, MatchResult, ContactOutcome, OutreachMethod } from '@/types'

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const hasAutoSent = useRef(false)
  const { state, addPersonLocal, batchMatchResultsLocal, toggleContactedLocal, setContactOutcomeLocal, setSurveyResponsesLocal } = useAppContext()

  // Load chat history on mount
  useEffect(() => {
    fetch('/api/ai/history')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load history')
        return res.json()
      })
      .then(data => {
        setMessages(data.messages || [])
      })
      .catch(() => {
        // Silently fail — will show empty chat
      })
      .finally(() => setIsLoading(false))
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Handle tool results — sync to AppContext
  const handleToolResult = useCallback(
    (name: string, input: Record<string, unknown>, result: Record<string, unknown>) => {
      if (result.error) return

      switch (name) {
        case 'add_contact':
          if (result.contact) {
            addPersonLocal(result.contact as PersonEntry)
          }
          break
        case 'run_matching':
          if (result.matchResults) {
            batchMatchResultsLocal(result.matchResults as MatchResult[])
          }
          break
        case 'log_conversation':
          if (result.contactId && result.outcome && result.method) {
            toggleContactedLocal(result.contactId as string, result.method as OutreachMethod)
            setContactOutcomeLocal(result.contactId as string, result.outcome as ContactOutcome)
          }
          if (result.contactId && input.surveyResponses) {
            setSurveyResponsesLocal(
              result.contactId as string,
              input.surveyResponses as Record<string, string>,
            )
          }
          break
        case 'update_match_status':
          // DB is already updated by the tool; no client-side sync needed
          break
      }
    },
    [addPersonLocal, batchMatchResultsLocal, toggleContactedLocal, setContactOutcomeLocal, setSurveyResponsesLocal],
  )

  const sendMessage = useCallback(
    async (messageText?: string) => {
      const text = (messageText || input).trim()
      if (!text || isStreaming) return

      const isInit = text === '__INIT__'

      if (!isInit) {
        setInput('')
      }
      setError(null)

      // Add user message (skip for __INIT__)
      if (!isInit) {
        const userMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'user',
          content: text,
          createdAt: new Date().toISOString(),
        }
        setMessages(prev => [...prev, userMessage])
      }

      // Create placeholder assistant message
      const assistantId = crypto.randomUUID()
      setMessages(prev => [
        ...prev,
        {
          id: assistantId,
          role: 'assistant',
          content: '',
          toolResults: [],
          createdAt: new Date().toISOString(),
        },
      ])

      setIsStreaming(true)

      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || 'Failed to send message')
        }

        const reader = response.body!.getReader()
        const decoder = new TextDecoder()

        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process complete SSE lines
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)

            if (data === '[DONE]') continue

            try {
              const event = JSON.parse(data)

              if (event.type === 'text') {
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId ? { ...m, content: m.content + event.text } : m,
                  ),
                )
              } else if (event.type === 'tool_result') {
                // Add tool result chip to the assistant message
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId
                      ? {
                          ...m,
                          toolResults: [
                            ...(m.toolResults || []),
                            { toolCallId: '', name: event.name, result: event.result },
                          ],
                        }
                      : m,
                  ),
                )
                handleToolResult(event.name, event.input || {}, event.result)
              } else if (event.type === 'error') {
                setError(event.message)
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong')
        // Remove empty assistant message on error
        setMessages(prev => prev.filter(m => m.id !== assistantId || m.content))
      } finally {
        setIsStreaming(false)
        inputRef.current?.focus()
      }
    },
    [input, isStreaming, handleToolResult],
  )

  // Auto-send welcome message when chat is empty
  useEffect(() => {
    if (!isLoading && messages.length === 0 && !hasAutoSent.current && !isStreaming) {
      hasAutoSent.current = true
      sendMessage('__INIT__')
    }
  }, [isLoading, messages.length, isStreaming, sendMessage])

  const clearHistory = async () => {
    try {
      await fetch('/api/ai/history', { method: 'DELETE' })
      setMessages([])
    } catch {
      setError('Failed to clear history')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-white/40">
          <Bot className="w-5 h-5 animate-pulse" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] md:h-[calc(100vh-220px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-vc-purple/20 ring-2 ring-vc-purple/40 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-vc-purple-light" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">AI Coach</h3>
            <p className="text-[10px] text-white/40">Your campaign assistant</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-white/20 hover:text-white/50 transition-colors p-1.5"
            title="Clear chat history"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {messages.map(msg => (
          <ChatMessageBubble
            key={msg.id}
            message={msg}
            isStreaming={isStreaming && msg.id === messages[messages.length - 1]?.id && msg.role === 'assistant'}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 pb-2">
          <div className="bg-red-500/20 text-red-300 text-xs px-3 py-2 rounded-lg border border-red-500/30">
            {error}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <ChatQuickActions
        onSend={sendMessage}
        contactCount={state.personEntries.length}
        contactedCount={state.actionPlanState.filter(i => i.contacted).length}
        disabled={isStreaming}
      />

      {/* Input area */}
      <div className="px-4 pb-4 pt-2">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            disabled={isStreaming}
            className="flex-1 glass-input rounded-2xl px-4 py-3 text-sm resize-none max-h-32 focus:ring-2 focus:ring-vc-purple/30 focus:border-vc-purple outline-none transition-all disabled:opacity-50"
            style={{ minHeight: '44px' }}
          />
          <button
            onClick={() => sendMessage()}
            disabled={isStreaming || !input.trim()}
            className="w-11 h-11 rounded-full bg-vc-purple hover:bg-vc-purple-light text-white flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-glow hover:shadow-glow-lg"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
