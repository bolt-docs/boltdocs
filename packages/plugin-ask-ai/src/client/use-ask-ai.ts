import { useState, useEffect, useRef, useCallback } from 'react'
import { Index } from 'flexsearch'
// @ts-expect-error
import searchData from 'virtual:boltdocs-search'
// @ts-expect-error
import clientConfig from 'virtual:boltdocs-config'

declare const __BOLTDOCS_ASK_AI_DEBUG__: boolean | undefined

let flexSearchIndex: Index | null = null

const IS_DEBUG =
  typeof __BOLTDOCS_ASK_AI_DEBUG__ !== 'undefined'
    ? Boolean(__BOLTDOCS_ASK_AI_DEBUG__)
    : false

const STREAM_TIMEOUT_MS = 90_000

export interface Message {
  role: 'user' | 'assistant'
  content: string
  readFile?: { path: string; timeMs: number }
}

export interface UseAskAiOptions {
  endpoint?: string
  currentLocale?: string
  currentVersion?: string
  currentPage?: string
}

export function useAskAi(options: UseAskAiOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const abortControllerRef = useRef<AbortController | null>(null)
  const streamTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  if (IS_DEBUG) {
    console.log('[Ask AI Debug] Hook initialized')
  }

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

  const clearStreamTimeout = useCallback(() => {
    if (streamTimeoutRef.current) {
      clearTimeout(streamTimeoutRef.current)
      streamTimeoutRef.current = null
    }
  }, [])

  const resetStreamTimeout = useCallback(
    (onTimeout: () => void) => {
      clearStreamTimeout()
      streamTimeoutRef.current = setTimeout(onTimeout, STREAM_TIMEOUT_MS)
    },
    [clearStreamTimeout],
  )

  const stopStreaming = useCallback(() => {
    clearStreamTimeout()
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsLoading(false)
  }, [clearStreamTimeout])

  useEffect(() => {
    if (!isOpen && isLoading) {
      stopStreaming()
    }
  }, [isOpen, isLoading, stopStreaming])

  const customEndpoint =
    options.endpoint ||
    clientConfig?.plugins?.find((p: any) => p.name === 'boltdocs-plugin-ask-ai')
      ?.endpoint ||
    '/api/ask-ai'

  const getContextForQuery = useCallback(
    (query: string): string[] => {
      if (!Array.isArray(searchData) || searchData.length === 0) {
        if (IS_DEBUG) {
          console.log(`[Ask AI Debug] No searchData available`)
        }
        return []
      }

      if (!flexSearchIndex) {
        flexSearchIndex = new Index({
          tokenize: 'forward',
          resolution: 9,
        })

        for (const doc of searchData) {
          flexSearchIndex.add(doc.id, `${doc.title} ${doc.content}`)
        }
      }

      let results = flexSearchIndex.search(query, { limit: 5 })

      if (results.length === 0) {
        const words = query
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 2)
        for (const word of words) {
          const wordResults = flexSearchIndex.search(word, { limit: 5 })
          for (const id of wordResults) {
            if (!results.includes(id)) results.push(id)
          }
          if (results.length >= 5) break
        }
      }

      const documentsMap = new Map<string, any>(
        searchData.map((d: any) => [d.id, d]),
      )
      const context: string[] = []

      for (const id of results) {
        const doc = documentsMap.get(id as string)
        if (!doc) continue
        if (options.currentLocale && doc.locale !== options.currentLocale)
          continue
        if (options.currentVersion && doc.version !== options.currentVersion)
          continue
        context.push(
          `Title: ${doc.title}\nPath: ${doc.url}\nContent: ${doc.content?.slice(0, 500)}`,
        )
      }

      if (context.length === 0) {
        for (const doc of searchData.slice(0, 5)) {
          context.push(
            `Title: ${doc.title}\nPath: ${doc.url}\nContent: ${doc.content?.slice(0, 500)}`,
          )
        }
      }

      if (IS_DEBUG) {
        console.log(
          `[Ask AI Debug] Context: ${context.length} docs for "${query}"`,
        )
      }

      return context.slice(0, 5)
    },
    [options.currentLocale, options.currentVersion],
  )

  const submitQuestion = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return

      if (IS_DEBUG) {
        console.log(`[Ask AI Debug] ─── Submit ───`)
        console.log(`[Ask AI Debug]   Question: "${text.slice(0, 200)}"`)
      }

      const userMsg: Message = { role: 'user', content: text }
      const initialAssistantMsg: Message = { role: 'assistant', content: '' }

      setMessages((prev) => [...prev, userMsg, initialAssistantMsg])
      setInput('')
      setIsLoading(true)

      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal
      const requestStartTime = Date.now()

      try {
        const context = getContextForQuery(text)
        const currentPage = options.currentPage || window.location.pathname

        if (IS_DEBUG) {
          console.log(`[Ask AI Debug]   Context docs: ${context.length}`)
          console.log(`[Ask AI Debug]   Current page: ${currentPage}`)
        }

        const response = await fetch(customEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: text, context, currentPage }),
          signal,
        })

        if (signal.aborted) return

        if (!response.ok) {
          throw new Error(
            `Server returned ${response.status}: ${response.statusText}`,
          )
        }

        if (!response.body) {
          throw new Error('No streaming body returned from endpoint')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let done = false
        let buffer = ''
        let chunkCount = 0
        let pendingContent = ''
        let rafScheduled = false
        let hasReceivedChunk = false

        const scheduleUpdate = () => {
          if (rafScheduled) return
          rafScheduled = true
          requestAnimationFrame(() => {
            rafScheduled = false
            const content = pendingContent
            if (content) {
              pendingContent = ''
              setMessages((prev) => {
                const next = [...prev]
                const last = next[next.length - 1]
                if (last && last.role === 'assistant') {
                  last.content += content
                  if (!last.readFile && hasReceivedChunk) {
                    const timeMs = Date.now() - requestStartTime
                    last.readFile = { path: currentPage, timeMs }
                  }
                }
                return next
              })
            }
          })
        }

        resetStreamTimeout(() => {
          if (!signal.aborted) {
            abortControllerRef.current?.abort()
          }
        })

        while (!done) {
          const { value, done: doneReading } = await reader.read()
          done = doneReading

          if (signal.aborted) return

          if (value) {
            resetStreamTimeout(() => {
              if (!signal.aborted) {
                abortControllerRef.current?.abort()
              }
            })

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''

            for (const line of lines) {
              const cleaned = line.trim()
              if (!cleaned.startsWith('data:')) continue

              const dataStr = cleaned.slice(5).trim()
              if (dataStr === '[DONE]') continue

              let parsed: any
              try {
                parsed = JSON.parse(dataStr)
              } catch {
                if (IS_DEBUG) {
                  console.warn(
                    `[Ask AI Debug]   Failed to parse SSE data: ${dataStr.slice(0, 100)}`,
                  )
                }
                continue
              }

              if (parsed.error) {
                throw new Error(parsed.error)
              }

              if (parsed.text) {
                hasReceivedChunk = true
                chunkCount++
                if (IS_DEBUG && chunkCount <= 3) {
                  console.log(
                    `[Ask AI Debug]   Chunk #${chunkCount}: "${parsed.text.slice(0, 80)}"`,
                  )
                }
                pendingContent += parsed.text
                scheduleUpdate()
              }
            }
          }
        }

        clearStreamTimeout()

        if (pendingContent) {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              last.content += pendingContent
            }
            return next
          })
        }

        if (!hasReceivedChunk) {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant' && !last.content) {
              last.content =
                '**Error**: No response received from the AI assistant. Please try again.'
            }
            return next
          })
        }

        if (IS_DEBUG) {
          console.log(`[Ask AI Debug]   Total chunks: ${chunkCount}`)
        }
      } catch (error) {
        clearStreamTimeout()

        if (error instanceof DOMException && error.name === 'AbortError') {
          if (IS_DEBUG) {
            console.log('[Ask AI Debug]   Streaming cancelled by user')
          }
          return
        }

        if (
          error instanceof Error &&
          error.name === 'TimeoutError' &&
          signal.aborted
        ) {
          if (IS_DEBUG) {
            console.log('[Ask AI Debug]   Stream timed out')
          }
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              last.content =
                '**Error**: The AI assistant took too long to respond. Please try again.'
            }
            return next
          })
          return
        }

        if (IS_DEBUG) {
          console.error(`[Ask AI Debug]   Error:`, error)
        } else {
          console.error('Failed to get answer from AI assistant:', error)
        }
        setMessages((prev) => {
          const next = [...prev]
          const last = next[next.length - 1]
          if (last && last.role === 'assistant') {
            last.content = `**Error**: ${
              error instanceof Error
                ? error.message
                : 'Failed to retrieve response'
            }`
          }
          return next
        })
      } finally {
        setIsLoading(false)
        abortControllerRef.current = null
      }
    },
    [
      customEndpoint,
      getContextForQuery,
      isLoading,
      resetStreamTimeout,
      clearStreamTimeout,
    ],
  )

  const clearChat = useCallback(() => {
    stopStreaming()
    setMessages([])
  }, [stopStreaming])

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
    isDebug: IS_DEBUG,
  }
}
