import { useCallback, useEffect, useRef, useState } from 'react'
import { useConfig } from 'boltdocs/client'

export type MessageStatus = 'reading' | 'streaming' | 'done' | 'error'

export interface Message {
  role: 'user' | 'assistant'
  content: string
  status?: MessageStatus
  contextChip?: {
    page: string
    chars: number
    elapsedMs?: number
    missing?: boolean
  }
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
    model: string
    provider: string
    elapsedMs: number
  }
  errorMessage?: string
}

export interface UseAskAiOptions {
  endpoint?: string
  currentPage?: string
}

const READING_TIMEOUT_MS = 30_000

export function useAskAi(options: UseAskAiOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Shared mutable state across the per-submission submit() and the
  // top-level stopStreaming(). Lifted to refs so both can reach them.
  const submitAbortRef = useRef<AbortController | null>(null)
  const pendingTextRef = useRef<{ value: string }>({ value: '' })
  const pendingRafRef = useRef<number | null>(null)

  const boltdocsConfig = useConfig()
  const askAiPluginMeta = boltdocsConfig?.plugins?.find(
    (p) => p.name === 'boltdocs-plugin-ask-ai',
  )?.metadata as { endpoint?: string; devMode?: boolean } | undefined

  const customEndpoint =
    options.endpoint || askAiPluginMeta?.endpoint || '/api/ask-ai'
  const devMode = askAiPluginMeta?.devMode ?? false

  useEffect(() => {
    const handleOpen = () => setIsOpen(true)
    const handleClose = () => setIsOpen(false)
    const handleToggle = () => setIsOpen((prev) => !prev)
    window.addEventListener('boltdocs:ask-ai:open', handleOpen)
    window.addEventListener('boltdocs:ask-ai:close', handleClose)
    window.addEventListener('boltdocs:ask-ai:toggle', handleToggle)
    return () => {
      window.removeEventListener('boltdocs:ask-ai:open', handleOpen)
      window.removeEventListener('boltdocs:ask-ai:close', handleClose)
      window.removeEventListener('boltdocs:ask-ai:toggle', handleToggle)
    }
  }, [])

  const startTimeRef = useRef<number>(0)
  const usageRef = useRef<Message['usage'] | null>(null)

  // Commit any text still in the pending buffer into the assistant
  // message, then cancel the queued raf. Safe to call multiple times.
  const flushPendingText = useCallback(() => {
    if (pendingRafRef.current !== null) {
      cancelAnimationFrame(pendingRafRef.current)
      pendingRafRef.current = null
    }
    if (!pendingTextRef.current.value) return
    const chunk = pendingTextRef.current.value
    pendingTextRef.current.value = ''
    setMessages((prev) => {
      const next = [...prev]
      const last = next[next.length - 1]
      if (last && last.role === 'assistant') last.content += chunk
      return next
    })
  }, [])

  const scheduleFlush = useCallback(() => {
    if (pendingRafRef.current !== null) return
    pendingRafRef.current = requestAnimationFrame(() => {
      pendingRafRef.current = null
      flushPendingText()
    })
  }, [flushPendingText])

  // Single source of truth for terminal finalization — both UI-initiated
  // stop, upstream abort, and any other catchable error funnel through
  // here so the terminal status is consistent: partial content ⇒ 'done',
  // empty content ⇒ 'error'. Drains the pending buffer first so partial
  // text is preserved even when the user cancels mid-stream.
  const finalizeAssistantTerminal = useCallback(
    (opts: { kind: 'cancel' | 'error'; message?: string }) => {
      flushPendingText()
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last && last.role === 'assistant' && last.status !== 'done') {
          last.status = last.content ? 'done' : 'error'
          if (last.status === 'error' && opts.message) {
            last.errorMessage = opts.message
          }
        }
        return next
      })
    },
    [flushPendingText],
  )

  const stopStreaming = useCallback(() => {
    if (submitAbortRef.current) {
      submitAbortRef.current.abort()
      // The in-flight submitQuestion's catch handler will recognise the
      // abort and re-apply finalization (idempotently).
    }
    setIsLoading(false)
    finalizeAssistantTerminal({ kind: 'cancel' })
  }, [finalizeAssistantTerminal])

  useEffect(() => {
    if (!isOpen && isLoading) stopStreaming()
  }, [isOpen, isLoading, stopStreaming])

  const clearChat = useCallback(() => {
    stopStreaming()
    setMessages([])
  }, [stopStreaming])

  const submitQuestion = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      // Reset per-submission pending state so leftover text/raf from a
      // prior submit doesn't leak into this one.
      pendingTextRef.current = { value: '' }
      pendingRafRef.current = null

      setMessages((prev) => [
        ...prev,
        { role: 'user', content: trimmed },
        { role: 'assistant', content: '', status: 'reading' },
      ])
      setInput('')
      setIsLoading(true)

      const controller = new AbortController()
      submitAbortRef.current = controller

      try {
        const currentPage =
          options.currentPage ||
          (typeof window !== 'undefined' ? window.location.pathname : '/')

        const response = await fetch(customEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: trimmed, currentPage }),
          signal: controller.signal,
        })

        if (!response.ok) {
          throw new Error(`Server returned ${response.status}`)
        }
        if (!response.body) {
          throw new Error('No streaming body from endpoint')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let lineBuffer = ''
        let firstTextSeen = false

        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          lineBuffer += decoder.decode(value, { stream: true })
          const lines = lineBuffer.split('\n')
          lineBuffer = lines.pop() || ''

          for (const line of lines) {
            const cleaned = line.trim()
            if (!cleaned.startsWith('data:')) continue
            const dataStr = cleaned.slice(5).trim()
            if (!dataStr || dataStr === '[DONE]') continue

            let parsed: any
            try {
              parsed = JSON.parse(dataStr)
            } catch {
              continue
            }

            if (parsed.context) {
              setMessages((prev) => {
                const next = [...prev]
                const last = next[next.length - 1]
                if (last && last.role === 'assistant') {
                  last.contextChip = parsed.context
                  startTimeRef.current = Date.now()
                }
                return next
              })
            } else if (parsed.usage) {
              usageRef.current = parsed.usage
            } else if (typeof parsed.text === 'string') {
              if (!firstTextSeen) {
                firstTextSeen = true
                setMessages((prev) => {
                  const next = [...prev]
                  const last = next[next.length - 1]
                  if (last && last.role === 'assistant') {
                    last.status = 'streaming'
                  }
                  return next
                })
              }
              pendingTextRef.current.value += parsed.text
              scheduleFlush()
            } else if (parsed.error) {
              throw new Error(parsed.error)
            }
          }
        }

        // Successful end-of-stream — drain pending text and decide terminal
        // status purely from whether content was produced. Use the helper
        // solely for its drain behaviour; the terminal semantics for a
        // normal completion is "done with content" or "error: no response".
        flushPendingText()
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant') {
            last.status = last.content ? 'done' : 'error'
            if (last.status === 'error' && !last.errorMessage) {
              last.errorMessage = 'No response received.'
            }
            if (usageRef.current && devMode) {
              last.usage = {
                ...usageRef.current,
                elapsedMs: startTimeRef.current
                  ? Date.now() - startTimeRef.current
                  : usageRef.current.elapsedMs,
              }
            }
          }
          return next
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          finalizeAssistantTerminal({
            kind: 'cancel',
            message: 'Request cancelled.',
          })
        } else {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          finalizeAssistantTerminal({ kind: 'error', message: msg })
          console.error('[Ask AI] failed:', error)
        }
      } finally {
        if (pendingRafRef.current !== null) {
          cancelAnimationFrame(pendingRafRef.current)
          pendingRafRef.current = null
        }
        if (submitAbortRef.current === controller) {
          submitAbortRef.current = null
        }
        setIsLoading(false)
      }
    },
    [
      customEndpoint,
      options.currentPage,
      isLoading,
      scheduleFlush,
      finalizeAssistantTerminal,
    ],
  )

  return {
    messages,
    input,
    setInput,
    isLoading,
    submitQuestion,
    stopStreaming,
    clearChat,
    isOpen,
    setIsOpen,
    devMode,
  }
}
