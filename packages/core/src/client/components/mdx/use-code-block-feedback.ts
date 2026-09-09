import { useCallback, useState } from 'react'
import { useConfig } from '../../app/config-context'

export interface CodeBlockFeedbackPayload {
  rating: 'good' | 'bad'
  comment: string
  blockId: string
  path: string
  title: string
  lang: string
  snippet: string
}

export interface UseCodeBlockFeedbackOptions {
  /** Plain blocks never show feedback. @default false */
  plain?: boolean
  /** Language label used to build the block id. */
  lang?: string
  /**
   * Custom submit handler. When provided it replaces the default POST to the
   * configured feedback endpoint (useful for plugins or custom backends).
   */
  submitFeedback?: (payload: CodeBlockFeedbackPayload) => Promise<void> | void
}

/**
 * Thumbs-up / thumbs-down feedback for code blocks. Only enabled when the
 * `feedback.custom` integration is configured in the site config. The submit
 * behavior can be overridden via `submitFeedback`.
 */
export function useCodeBlockFeedback(
  options: UseCodeBlockFeedbackOptions = {},
) {
  const { plain = false, lang = '', submitFeedback } = options
  const [rated, setRated] = useState<'up' | 'down' | null>(null)

  const config = useConfig()
  const customConfig = config.integrations?.feedback?.custom
  const enabled = !!(customConfig?.enabled && !plain)

  const handleRate = useCallback(
    async (type: 'up' | 'down', code?: string) => {
      if (rated) return
      setRated(type)

      const snippet = code
        ? code.trim().slice(0, 100) + (code.length > 100 ? '...' : '')
        : ''
      const blockId = `Code Block (${lang || 'plain'}): \`${snippet}\``
      const payload: CodeBlockFeedbackPayload = {
        rating: type === 'up' ? 'good' : 'bad',
        comment: `Rated code block: ${type === 'up' ? 'Helpful' : 'Unhelpful'}`,
        path: window.location.pathname,
        title: document.title,
        blockId,
        lang,
        snippet,
      }

      try {
        if (submitFeedback) {
          await submitFeedback(payload)
          return
        }
        const endpoint = customConfig?.endpoint || '/api/feedback'
        await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })
      } catch (err) {
        console.error('Failed to submit code block feedback:', err)
      }
    },
    [rated, lang, customConfig?.endpoint, submitFeedback],
  )

  return { rated, handleRate, enabled }
}
