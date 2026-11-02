import { useFeedback } from '../../hooks/use-feedback'
import { useConfig } from '@bdocs/runtime'
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
    <div className={cn('bdocs-feedback', className)}>
      {submitted ? (
        <div className="bdocs-feedback__thanks">
          <div className="bdocs-feedback__thanks-mark">
            <Check size={24} />
          </div>
          <h3 className="bdocs-feedback__thanks-title">
            Thank you for your feedback!
          </h3>
          <p className="bdocs-feedback__thanks-body">
            Your comments help us improve the documentation.
          </p>
        </div>
      ) : (
        <div className="bdocs-feedback__body">
          <div className="bdocs-feedback__row">
            {/* h3: the page h1/h2 live above; an h4 here skips a level (axe
                `heading-order`). */}
            <h3 className="bdocs-feedback__title">Was this page helpful?</h3>
            <div className="bdocs-feedback__ratings">
              <button
                type="button"
                onClick={() => setRating('good')}
                className="bdocs-feedback__rating"
                data-selected={rating === 'good' || undefined}
                aria-label="Helpful"
              >
                <FaceGood />
                <span>Yes</span>
              </button>

              <button
                type="button"
                onClick={() => setRating('neutral')}
                className="bdocs-feedback__rating"
                data-selected={rating === 'neutral' || undefined}
                aria-label="Neutral"
              >
                <FaceRegular />
                <span>Regular</span>
              </button>

              <button
                type="button"
                onClick={() => setRating('bad')}
                className="bdocs-feedback__rating"
                data-selected={rating === 'bad' || undefined}
                aria-label="Not helpful"
              >
                <FaceBad />
                <span>No</span>
              </button>
            </div>
          </div>

          {rating && (
            <div className="bdocs-feedback__comment">
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="¿Tienes alguna sugerencia para mejorar esta página? (Opcional)"
                className="bdocs-feedback__textarea"
              />
              <div className="bdocs-feedback__actions">
                {error && <p className="bdocs-feedback__error">{error}</p>}
                <div className="bdocs-feedback__actions-right">
                  <button
                    type="button"
                    onClick={() => submit()}
                    disabled={loading}
                    className="bdocs-feedback__submit"
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
