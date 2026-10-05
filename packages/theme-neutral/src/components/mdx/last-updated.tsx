import { cn } from '../../utils/cn'
import { formatDeterministicDate } from '../../utils/date'

interface LastUpdatedProps {
  date?: string | number | Date
  className?: string
}

/**
 * A subtle display for when the page was last updated.
 * Small, opaque, and positioned at the bottom of the content with a thin top border divider.
 */
export function LastUpdated({ date, className }: LastUpdatedProps) {
  if (!date) return null

  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null

  // Locale and zone are pinned: an ambient default makes the server and the
  // browser disagree and React discards the server-rendered HTML.
  const formattedDate = formatDeterministicDate(d)

  return (
    <div
      className={cn(
        'mt-16 pt-6 border-t border-subtle flex items-center justify-between text-xs text-muted select-none',
        className,
      )}
    >
      <span></span>
      <span className="italic">Last updated on {formattedDate}</span>
    </div>
  )
}
