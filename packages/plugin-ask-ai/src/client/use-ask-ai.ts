import { useState, useEffect, useRef, useCallback } from 'react'
import { Index } from 'flexsearch'
// @ts-expect-error
import searchData from 'virtual:boltdocs-search'
// @ts-expect-error
import clientConfig from 'virtual:boltdocs-config'

declare const __BOLTDOCS_ASK_AI_DEBUG__: boolean | undefined

let flexSearchIndex: Index | null = null

const IS_DEBUG = typeof __BOLTDOCS_ASK_AI_DEBUG__ !== 'undefined'
  ? Boolean(__BOLTDOCS_ASK_AI_DEBUG__)
  : false

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface UseAskAiOptions {
  endpoint?: string
  currentLocale?: string
  currentVersion?: string
}

export function useAskAi(options: UseAskAiOptions = {}) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  if (IS_DEBUG) {
    console.log('[Ask AI Debug] Hook initialized')
  }

  // Listen to custom window events for global triggers (navbar, MDX links, etc.)
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

  // Configure endpoint from props or config
  const customEndpoint =
    options.endpoint ||
    clientConfig?.plugins?.find((p: any) => p.name === 'boltdocs-plugin-ask-ai')?.endpoint ||
    '/api/ask-ai'

  // Lazy initialize flexsearch index
  const getContextForQuery = useCallback((query: string): string[] => {
    if (!flexSearchIndex) {
      flexSearchIndex = new Index({
        preset: 'match',
        tokenize: 'full',
        resolution: 9,
      })

      if (Array.isArray(searchData)) {
        for (const doc of searchData) {
          flexSearchIndex.add(doc.id, `${doc.title} ${doc.content}`)
        }
      }
    }

    const results = flexSearchIndex.search(query, { limit: 5 })
    const documentsMap = new Map<string, any>(
      searchData?.map((d: any) => [d.id, d]) || [],
    )
    const context: string[] = []

    for (const id of results) {
      const doc = documentsMap.get(id as string)
      if (!doc) continue

      if (options.currentLocale && doc.locale !== options.currentLocale) continue
      if (options.currentVersion && doc.version !== options.currentVersion) continue

      context.push(
        `Title: ${doc.title}\nPath: ${doc.url}\nContent: ${doc.content}`,
      )
    }

    return context.slice(0, 3)
  }, [options.currentLocale, options.currentVersion])

  const submitQuestion = useCallback(async (text: string) => {
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

    try {
      const context = getContextForQuery(text)

      if (IS_DEBUG) {
        console.log(`[Ask AI Debug]   Context docs: ${context.length}`)
        context.forEach((c, i) => {
          console.log(`[Ask AI Debug]   Doc ${i + 1}: ${c.slice(0, 150)}...`)
        })
      }

      const response = await fetch(customEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: text,
          context,
        }),
      })

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('No streaming body returned from endpoint')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let done = false
      let buffer = ''
      let chunkCount = 0

      while (!done) {
        const { value, done: doneReading } = await reader.read()
        done = doneReading

        if (value) {
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            const cleaned = line.trim()
            if (cleaned.startsWith('data:')) {
              const dataStr = cleaned.slice(5).trim()
              if (dataStr === '[DONE]') continue

              try {
                const parsed = JSON.parse(dataStr)
                if (parsed.text) {
                  chunkCount++
                  if (IS_DEBUG && chunkCount <= 3) {
                    console.log(`[Ask AI Debug]   Chunk #${chunkCount}: "${parsed.text.slice(0, 80)}"`)
                  }
                  setMessages((prev) => {
                    const next = [...prev]
                    const last = next[next.length - 1]
                    if (last && last.role === 'assistant') {
                      last.content += parsed.text
                    }
                    return next
                  })
                } else if (parsed.error) {
                  throw new Error(parsed.error)
                }
              } catch (e) {
                // Ignore parse errors from partial JSON
              }
            }
          }
        }
      }

      if (IS_DEBUG) {
        console.log(`[Ask AI Debug]   Total chunks: ${chunkCount}`)
      }
    } catch (error) {
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
            error instanceof Error ? error.message : 'Failed to retrieve response'
          }`
        }
        return next
      })
    } finally {
      setIsLoading(false)
    }
  }, [customEndpoint, getContextForQuery, isLoading])

  const clearChat = useCallback(() => {
    setMessages([])
    setIsLoading(false)
  }, [])

  return {
    messages,
    input,
    setInput,
    isLoading,
    submitQuestion,
    clearChat,
    isOpen,
    setIsOpen,
    isDebug: IS_DEBUG,
  }
}
