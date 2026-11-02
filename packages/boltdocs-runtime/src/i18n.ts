/**
 * Retrieves the correct translation from a value that can be either
 * a simple string or a map of locale-specific strings.
 *
 * @param value - The text to translate
 * @param locale - The current active locale (e.g., 'en', 'es')
 * @returns The translated string
 */
export function getTranslated(
  value: string | Record<string, string> | undefined,
  locale?: string,
): string {
  if (!value) return ''
  if (typeof value === 'string') return value

  if (locale && value[locale]) {
    return value[locale]
  }

  // Fallback: Use the first available translation or an empty string
  const firstValue = Object.values(value)[0]
  return firstValue || ''
}
