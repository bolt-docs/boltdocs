import { useCallback, useEffect, useRef, useState } from 'react'
import { useConfig } from 'boltdocs/client'
import type { ClientController } from './abort'
import { createClientController } from './abort'

export type MessageStatus =
  | 'reading'
  | 'streaming'
  | 'done'
  | 'cancelled'
  | 'error'

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

/** User-facing copy for the widget, configurable via plugin options. */
export interface AskAiUiCopy {
  title: string
  placeholder: string
  emptyTitle: string
  emptyDescription: string
  buttonTooltip: string
  composerHint: string
}

export const DEFAULT_ASK_AI_UI_COPY: AskAiUiCopy = {
  title: 'Ask Assistant',
  placeholder: 'Ask about this page…',
  emptyTitle: 'How can I help you today?',
  emptyDescription:
    'Ask anything about the current documentation page. The assistant only answers using the page you are viewing.',
  buttonTooltip: 'Ask AI assistant',
  composerHint: 'Enter to send · Shift+Enter for a new line',
}

function readUiCopy(meta: Record<string, unknown> | undefined): AskAiUiCopy {
  if (!meta) return DEFAULT_ASK_AI_UI_COPY
  const str = (key: keyof AskAiUiCopy): string => {
    const v = meta[key]
    return typeof v === 'string' && v.length > 0
      ? v
      : DEFAULT_ASK_AI_UI_COPY[key]
  }
  return {
    title: str('title'),
    placeholder: str('placeholder'),
    emptyTitle: str('emptyTitle'),
    emptyDescription: str('emptyDescription'),
    buttonTooltip: str('buttonTooltip'),
    composerHint: str('composerHint'),
  }
}

export function useAskAi(options: UseAskAiOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Shared mutable state across the per-submission submit() and the
  // top-level stopStreaming(). Lifted to refs so both can reach them.
  const submitAbortRef = useRef<ClientController | null>(null)
  const pendingTextRef = useRef<{ value: string }>({ value: '' })
  const pendingRafRef = useRef<number | null>(null)

  const boltdocsConfig = useConfig()
  const askAiPluginMeta = boltdocsConfig?.plugins?.find(
    (p) => p.name === 'boltdocs-plugin-ask-ai',
  )?.metadata as
    | (Record<string, unknown> & {
        endpoint?: string
        devMode?: boolean
      })
    | undefined

  const customEndpoint =
    options.endpoint || askAiPluginMeta?.endpoint || '/api/ask-ai'
  const devMode = askAiPluginMeta?.devMode ?? false
  const ui = readUiCopy(askAiPluginMeta)

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
      const next = prev.slice()
      const i = next.length - 1
      const last = next[i]
      // Replace (don't mutate) the last assistant message so memoized
      // siblings keep their identity and only this message re-renders.
      if (last && last.role === 'assistant') {
        next[i] = { ...last, content: last.content + chunk }
      }
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
        if (
          last &&
          last.role === 'assistant' &&
          last.status !== 'done' &&
          last.status !== 'cancelled'
        ) {
          last.status = opts.kind === 'cancel' ? 'cancelled' : 'error'
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

      // Replaces the trailing assistant message with a new object so the
      // memoized ChatMessage re-renders exactly the message that changed.
      const replaceLastAssistant = (
        prev: Message[],
        apply: (msg: Message) => Message,
      ): Message[] => {
        const next = prev.slice()
        const i = next.length - 1
        const last = next[i]
        if (last && last.role === 'assistant') next[i] = apply(last)
        return next
      }

      const controller = createClientController()
      submitAbortRef.current = controller

      try {
        const currentPage =
          options.currentPage ||
          (typeof window !== 'undefined' ? window.location.pathname : '/')

        const init: RequestInit = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: trimmed, currentPage }),
        }
        // Only attach a signal when the host can provide a real AbortSignal.
        if (controller.signal) init.signal = controller.signal

        const response = await fetch(customEndpoint, init)

        if (!response.ok) {
          const errorBody = await response.text()
          let errorMessage = `Server returned ${response.status}`
          try {
            const parsed = JSON.parse(errorBody) as { error?: unknown }
            if (typeof parsed.error === 'string') errorMessage = parsed.error
          } catch {
            // Keep the HTTP status when the adapter returns a non-JSON error.
          }
          throw new Error(errorMessage)
        }
        if (!response.body) {
          throw new Error('No streaming body from endpoint')
        }

        const reader = response.body.getReader()
        controller.attachReader(reader)
        const decoder = new TextDecoder()
        let lineBuffer = ''
        let firstTextSeen = false

        while (!controller.aborted) {
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

            let parsed: {
              context?: Message['contextChip']
              usage?: Message['usage']
              text?: unknown
              error?: unknown
            }
            try {
              parsed = JSON.parse(dataStr)
            } catch {
              continue
            }

            if (parsed.context) {
              setMessages((prev) =>
                replaceLastAssistant(prev, (last) => {
                  startTimeRef.current = Date.now()
                  return { ...last, contextChip: parsed.context }
                }),
              )
            } else if (parsed.usage) {
              usageRef.current = parsed.usage
            } else if (typeof parsed.text === 'string') {
              if (!firstTextSeen) {
                firstTextSeen = true
                setMessages((prev) =>
                  replaceLastAssistant(prev, (last) => ({
                    ...last,
                    status: 'streaming',
                  })),
                )
              }
              pendingTextRef.current.value += parsed.text
              scheduleFlush()
            } else if (typeof parsed.error === 'string') {
              throw new Error(parsed.error)
            }
          }
        }

        // Cooperative abort (e.g. no native AbortController): the flag was
        // checked above, so if we exit the loop aborted, finalize as a
        // cancellation without running the normal-completion path.
        if (controller.aborted) {
          pendingTextRef.current.value = ''
          if (pendingRafRef.current !== null) {
            cancelAnimationFrame(pendingRafRef.current)
            pendingRafRef.current = null
          }
          finalizeAssistantTerminal({ kind: 'cancel' })
          return
        }

        // Successful end-of-stream — drain pending text and decide terminal
        // status purely from whether content was produced. Use the helper
        // solely for its drain behaviour; the terminal semantics for a
        // normal completion is "done with content" or "error: no response".
        flushPendingText()
        setMessages((prev) =>
          replaceLastAssistant(prev, (last) => {
            const status = last.content ? 'done' : 'error'
            const usage =
              usageRef.current && devMode
                ? {
                    ...usageRef.current,
                    elapsedMs: startTimeRef.current
                      ? Date.now() - startTimeRef.current
                      : usageRef.current.elapsedMs,
                  }
                : last.usage
            return {
              ...last,
              status,
              errorMessage:
                status === 'error' && !last.errorMessage
                  ? 'No response received.'
                  : last.errorMessage,
              usage,
            }
          }),
        )
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          finalizeAssistantTerminal({
            kind: 'cancel',
            message: 'Request cancelled.',
          })
        } else {
          const msg = error instanceof Error ? error.message : 'Unknown error'
          const userMessage = msg.includes('API_KEY')
            ? 'The AI assistant is not configured on this server.'
            : msg.includes('RATE_LIMITED')
              ? 'Too many requests. Please try again shortly.'
              : msg.includes('UNAUTHORIZED')
                ? 'This assistant requires authorization.'
                : msg.includes('CLIENT_CONTEXT_NOT_ALLOWED')
                  ? 'This deployment does not accept client-provided context.'
                  : msg
          finalizeAssistantTerminal({ kind: 'error', message: msg })
          setMessages((prev) =>
            replaceLastAssistant(prev, (last) =>
              last.status === 'error'
                ? { ...last, errorMessage: userMessage }
                : last,
            ),
          )
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
      devMode,
      flushPendingText,
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
    ui,
  }
}
