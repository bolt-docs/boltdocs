import { useFeedback } from 'boltdocs/client'
import { useConfig } from 'boltdocs/client'
import { cn } from 'boltdocs/client'
import { Button } from '@/theme/button'
import { Check, ThumbsUp, ThumbsDown, Minus } from 'lucide-react'

export interface FeedbackProps {
  className?: string
}

export function Feedback({ className }: FeedbackProps) {
  const config = useConfig()
  const customConfig = config.integrations?.feedback?.custom

  if (!customConfig?.enabled) return null

  const {
    rating,
    setRating,
    comment,
    setComment,
    loading,
    submitted,
    error,
    submit,
  } = useFeedback()

  return (
    <div
      className={cn(
        'w-full max-w-2xl mt-12 mb-6 p-6 rounded-xl bg-surface select-none',
        className,
      )}
    >
      {submitted ? (
        <div className="flex flex-col items-center justify-center py-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-500/10 text-success-500 mb-3 border border-success-500/20">
            <Check size={20} />
          </div>
          <h3 className="text-base font-semibold text-body">
            Thank you for your feedback!
          </h3>
          <p className="text-sm text-muted mt-1">
            Your comments help us improve the documentation.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h4 className="text-base font-semibold text-body">
              Was this page helpful?
            </h4>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="md"
                onPress={() => setRating('good')}
                aria-label="Helpful"
                className={cn(
                  'px-3',
                  rating === 'good'
                    ? 'border-primary-500 bg-primary-500/10 text-primary-500'
                    : 'text-muted hover:border-strong hover:bg-soft hover:text-body',
                )}
              >
                <ThumbsUp className="size-16" />
                <span>Yes</span>
              </Button>

              <Button
                variant="outline"
                size="md"
                onPress={() => setRating('neutral')}
                aria-label="Neutral"
                className={cn(
                  'px-3',
                  rating === 'neutral'
                    ? 'border-primary-500 bg-primary-500/10 text-primary-500'
                    : 'text-muted hover:border-strong hover:bg-soft hover:text-body',
                )}
              >
                <Minus className="size-16" />
                <span>Regular</span>
              </Button>

              <Button
                variant="outline"
                size="md"
                onPress={() => setRating('bad')}
                aria-label="Not helpful"
                className={cn(
                  'px-3',
                  rating === 'bad'
                    ? 'border-primary-500 bg-primary-500/10 text-primary-500'
                    : 'text-muted hover:border-strong hover:bg-soft hover:text-body',
                )}
              >
                <ThumbsDown className="size-16" />
                <span>No</span>
              </Button>
            </div>
          </div>

          {rating && (
            <div className="flex flex-col gap-3 mt-1">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Do you have any suggestions to improve this page? (Optional)"
                className="w-full h-24 p-3 text-sm rounded-md border border-subtle bg-main text-body placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 resize-none transition-shadow"
              />
              <div className="flex items-center justify-between gap-3">
                {error && (
                  <p className="text-xs text-error-500 font-medium flex-1">
                    {error}
                  </p>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    variant="primary"
                    size="sm"
                    onPress={() => submit()}
                    isDisabled={loading}
                  >
                    {loading ? 'Submitting...' : 'Submit'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
