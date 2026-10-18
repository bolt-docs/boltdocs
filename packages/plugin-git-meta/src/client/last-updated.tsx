import { cn } from 'boltdocs/client'
import { formatDeterministicDate } from 'boltdocs/client'

export interface LastUpdatedProps {
  /** Date sourced from git (or any explicit route date). */
  date?: string | number | Date
  /** Prefix rendered before the date. Default: `'Last updated on'`. */
  label?: string
  /** Custom formatter. Default: deterministic `en-US` / UTC formatting. */
  formatDate?: (date: Date) => string
  className?: string
}

/**
 * Date-only label exported by the plugin so themes can compose their own
 * footer. The default Boltdocs layout already renders the route date, so this
 * component is intended for custom layouts and landing pages.
 */
export function LastUpdated({
  date,
  label = 'Last updated on',
  formatDate = (value) => formatDeterministicDate(value),
  className,
}: LastUpdatedProps) {
  if (!date) return null
  const parsed = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(parsed.getTime())) return null

  return (
    <span className={cn('text-xs italic text-muted', className)}>
      {label} {formatDate(parsed)}
    </span>
  )
}
