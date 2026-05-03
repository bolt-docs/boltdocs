interface LastUpdatedProps {
  date?: string | number | Date
}

/**
 * A subtle display for when the page was last updated.
 * Small, opaque, and positioned at the bottom of the content.
 */
export function LastUpdated({ date }: LastUpdatedProps) {
  if (!date) return null

  const d = new Date(date)
  if (isNaN(d.getTime())) return null

  const formattedDate = d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="mt-16 text-right text-xs opacity-50 italic">
      Last updated on {formattedDate}
    </div>
  )
}
