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
 * Plugins can render content on the left side of the footer through the
 * `page:footer:start` client slot (for example the contributors plugin).
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
    <div
      className={cn(
        'mt-16 pt-6 border-t border-subtle flex flex-wrap items-center justify-between gap-3 text-xs text-muted select-none',
        className,
      )}
    >
      <PluginSlot name="page:footer:start" />
      <span className="ml-auto italic">Last updated on {formattedDate}</span>
    </div>
  )
}
