/**
 * Formats a date to a human-readable string.
 * @param date The date to format.
 * @returns The formatted date string.
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
