import { formatDeterministicDate } from '../date'

/**
 * Formats a date to a human-readable string.
 *
 * Locale and time zone are pinned so the server and the browser produce
 * identical text during hydration. See `formatDeterministicDate`.
 */
export function formatDate(
  date: string | Date | undefined | null,
  options: {
    month?: 'numeric' | '2-digit' | 'long' | 'short'
    day?: 'numeric' | '2-digit'
  } = {},
): string {
  return formatDeterministicDate(date, options)
}

/**
 * Formats a collection date using `collections.dateFormat` tokens.
 *
 * Supported tokens: `yyyy`, `yy`, `MMMM`, `MMM`, `MM`, `M`, `dd`, `d`.
 * Locale and zone stay pinned so the text is identical on server and client.
 */
export function formatCollectionDate(
  date: string | Date | undefined | null,
  format = 'MMMM dd, yyyy',
): string {
  if (date === undefined || date === null || date === '') return ''
  const parsed = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(parsed.getTime())) return ''

  // Format each field separately and substitute it in place. Passing all the
  // fields to Intl at once would impose the locale's field order (e.g.
  // 09/07/2026) instead of the order the format string asks for.
  const part = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(
      parsed,
    )

  const replacements: [string, string][] = [
    ['yyyy', part({ year: 'numeric' })],
    ['yy', part({ year: '2-digit' })],
    ['MMMM', part({ month: 'long' })],
    ['MMM', part({ month: 'short' })],
    ['MM', part({ month: '2-digit' })],
    ['M', part({ month: 'numeric' })],
    ['dd', part({ day: '2-digit' })],
    ['d', part({ day: 'numeric' })],
  ]

  let result = format
  for (const [token, value] of replacements) {
    result = result.split(token).join(value)
  }
  return result
}
