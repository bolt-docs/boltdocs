import { useState, useEffect } from 'react'
import { useConfig } from '../app/config-context'
import { useRoutes } from './use-routes'

export interface FeedbackData {
  rating: 'good' | 'neutral' | 'bad'
  comment?: string
  path: string
  title: string
  blockId?: string
}

export interface UseFeedbackOptions {
  endpoint?: string
  onSubmit?: (data: FeedbackData) => void | Promise<void>
}

/**
 * Hook for managing the feedback rating form state and submission.
 * Resets automatically when navigating to a new page.
 */
export function useFeedback(options: UseFeedbackOptions = {}) {
  const config = useConfig()
  const { currentRoute } = useRoutes()

  const [rating, setRating] = useState<'good' | 'neutral' | 'bad' | null>(null)
  const [comment, setComment] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset feedback state when the active page route changes
  useEffect(() => {
    setRating(null)
    setComment('')
    setSubmitted(false)
    setError(null)
  }, [currentRoute?.path])

  const submit = async (commentOverride?: string, blockId?: string) => {
    if (!rating) return

    setLoading(true)
    setError(null)

    const finalComment =
      commentOverride !== undefined ? commentOverride : comment
    const payload: FeedbackData = {
      rating,
      comment: finalComment || undefined,
      path: currentRoute?.path || window.location.pathname,
      title: currentRoute?.title || document.title,
      blockId,
    }

    try {
      if (options.onSubmit) {
        await options.onSubmit(payload)
      } else {
        const endpoint =
          options.endpoint ||
          config.integrations?.feedback?.custom?.endpoint ||
          '/api/feedback'

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const text = await res.text()
          let errorText = text
          try {
            const data = JSON.parse(text)
            errorText = data.error || data.message || text
          } catch {}
          throw new Error(
            errorText || `Failed to submit feedback: ${res.statusText}`,
          )
        }
      }
      setSubmitted(true)
    } catch (e: any) {
      setError(e.message || 'An error occurred while submitting feedback.')
    } finally {
      setLoading(false)
    }
  }

  return {
    rating,
    setRating,
    comment,
    setComment,
    loading,
    submitted,
    error,
    submit,
  }
}
