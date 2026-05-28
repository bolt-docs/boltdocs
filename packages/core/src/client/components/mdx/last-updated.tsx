interface LastUpdatedProps {
  date?: string | number | Date
}

/**
 * A subtle display for when the page was last updated.
 * Small, opaque, and positioned at the bottom of the content with a thin top border divider.
 */
export function LastUpdated({ date }: LastUpdatedProps) {
  if (!date) return null

  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null

  const formattedDate = d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="mt-16 pt-6 border-t border-subtle flex items-center justify-between text-xs text-muted select-none">
      <span></span>
      <span className="italic">Last updated on {formattedDate}</span>
    </div>
  )
}
