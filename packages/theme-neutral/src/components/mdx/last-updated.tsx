import { cn } from '../../utils/cn'
import { formatDeterministicDate } from '../../utils/date'
import { PluginSlot } from '../plugin-slot'

interface LastUpdatedProps {
  date?: string | number | Date
  className?: string
}

/**
 * A subtle display for when the page was last updated.
 *
 * Small, opaque, and positioned at the bottom of the content with a thin top
 * border divider. Plugins can render content on the left side of the footer
 * through the `page:footer:start` client slot — the contributors plugin uses it
 * — and a plugin's slot still renders when the route carries no date.
 *
 * `select-none` is kept in the stylesheet rather than as an exception: a date the
 * reader is not meant to copy should not start a selection that includes the
 * paragraph above it.
 */
export function LastUpdated({ date, className }: LastUpdatedProps) {
  if (!date) return <PluginSlot name="page:footer:start" />

  const d = new Date(date)
  if (Number.isNaN(d.getTime())) {
    return <PluginSlot name="page:footer:start" />
  }

  // Locale and zone are pinned: an ambient default makes the server and the
  // browser disagree and React discards the server-rendered HTML.
  const formattedDate = formatDeterministicDate(d)

  return (
    <div className={cn('bdocs-last-updated', className)}>
      <PluginSlot name="page:footer:start" />
      <span className="bdocs-last-updated__date">
        Last updated on {formattedDate}
      </span>
    </div>
  )
}
