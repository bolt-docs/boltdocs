/**
 * Deterministic date formatting for server-rendered output.
 *
 * `toLocaleDateString` with no locale resolves against the *runtime* default,
 * which is not the same in Node and in a browser: the server rendered
 * "26 de septiembre de 2026" from an `es` system locale while the client
 * produced "September 26, 2026". That is a text mismatch during hydration and
 * React throws away the server HTML and re-renders the whole page.
 *
 * The time zone has to be pinned for the same reason. A frontmatter date such
 * as `2026-09-27` parses as UTC midnight, so any zone behind UTC renders the
 * previous day and any zone ahead renders the correct one, which is a second,
 * environment-dependent mismatch.
 *
 * Both are therefore explicit here. Callers that genuinely want a different
 * locale can pass one, and it is still deterministic because it is fixed in
 * the markup rather than inferred.
 */

const DEFAULT_LOCALE = 'en-US'
const DEFAULT_TIME_ZONE = 'UTC'

/**
 * Formats a date as a stable, locale- and zone-pinned string.
 *
 * Returns an empty string for values that are not real dates so callers can
 * render nothing rather than "Invalid Date".
 */
export function formatDeterministicDate(
  date: string | number | Date | undefined | null,
  options: {
    locale?: string
    timeZone?: string
    month?: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow'
    day?: 'numeric' | '2-digit'
  } = {},
): string {
  if (date === undefined || date === null || date === '') return ''

  const parsed = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(parsed.getTime())) return ''

  return parsed.toLocaleDateString(options.locale ?? DEFAULT_LOCALE, {
    year: 'numeric',
    month: options.month ?? 'long',
    day: options.day ?? 'numeric',
    timeZone: options.timeZone ?? DEFAULT_TIME_ZONE,
  })
}
