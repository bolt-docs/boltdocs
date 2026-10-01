import { formatDeterministicDate } from '../utils/date'

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
