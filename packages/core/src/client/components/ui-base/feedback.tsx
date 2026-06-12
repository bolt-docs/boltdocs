import { useFeedback } from '../../hooks/use-feedback'
import { useConfig } from '../../app/config-context'
import { cn } from '../../utils/cn'
import { Check, FaceBad, FaceGood, FaceRegular } from './icons'

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
        'w-full max-w-2xl mt-12 mb-6 p-6 rounded-2xl border border-subtle bg-surface/50 backdrop-blur-xs select-none',
        className,
      )}
    >
      {submitted ? (
        <div className="flex flex-col items-center justify-center py-4 text-center animate-in fade-in zoom-in duration-300">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 mb-3 border border-emerald-500/20">
            <Check size={24} />
          </div>
          <h3 className="text-lg font-semibold text-default">
            Thank you for your feedback!
          </h3>
          <p className="text-sm text-muted mt-1">
            Your comments help us improve the documentation.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h4 className="text-base font-semibold text-default">
              Was this page helpful?
            </h4>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRating('good')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all duration-200 outline-none cursor-pointer',
                  rating === 'good'
                    ? 'border-primary-500 bg-primary-500/10 text-primary-500 dark:text-primary-400'
                    : 'border-subtle hover:border-body hover:bg-surface text-muted hover:text-body',
                )}
                aria-label="Helpful"
              >
                <FaceGood />
                <span>Yes</span>
              </button>

              <button
                type="button"
                onClick={() => setRating('neutral')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all duration-200 outline-none cursor-pointer',
                  rating === 'neutral'
                    ? 'border-primary-500 bg-primary-500/10 text-primary-500 dark:text-primary-400'
                    : 'border-subtle hover:border-body hover:bg-surface text-muted hover:text-body',
                )}
                aria-label="Neutral"
              >
                <FaceRegular />
                <span>Regular</span>
              </button>

              <button
                type="button"
                onClick={() => setRating('bad')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all duration-200 outline-none cursor-pointer',
                  rating === 'bad'
                    ? 'border-primary-500 bg-primary-500/10 text-primary-500 dark:text-primary-400'
                    : 'border-subtle hover:border-body hover:bg-surface text-muted hover:text-body',
                )}
                aria-label="Not helpful"
              >
                <FaceBad />
                <span>No</span>
              </button>
            </div>
          </div>

          {rating && (
            <div className="flex flex-col gap-3 mt-1 animate-in slide-in-from-top-3 duration-300">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="¿Tienes alguna sugerencia para mejorar esta página? (Opcional)"
                className="w-full h-24 p-3 text-sm rounded-xl border border-subtle bg-main text-body placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 resize-none transition-shadow"
              />
              <div className="flex items-center justify-between gap-3">
                {error && (
                  <p className="text-xs text-rose-500 font-medium flex-1">
                    {error}
                  </p>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    type="button"
                    onClick={() => submit()}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary-500 hover:bg-primary-600 active:bg-primary-700 text-white transition-colors outline-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
