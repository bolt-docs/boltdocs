import type { BoltdocsConfig } from 'boltdocs'

export function getSiteTitle(config: BoltdocsConfig): string {
  const title = config.theme?.title
  if (typeof title === 'object' && title !== null) {
    return Object.values(title)[0] ?? 'Documentation'
  }
  return title ?? 'Documentation'
}

export function getLocales(config: BoltdocsConfig): string[] {
  const locales = config.i18n?.locales
  if (!locales) return ['en']
  return Array.isArray(locales) ? locales : Object.keys(locales)
}

export function getLocalizedTitle(
  config: BoltdocsConfig,
  locale: string,
  fallback: string,
): string {
  const title = config.theme?.title
  if (typeof title !== 'object' || title === null) {
    return title ?? fallback
  }

  const defaultLocale = config.i18n?.defaultLocale ?? 'en'
  return title[locale] ?? title[defaultLocale] ?? fallback
}

export function getLocalizedDescription(
  config: BoltdocsConfig,
  locale: string,
): string {
  const description = config.theme?.description
  if (typeof description !== 'object' || description === null) {
    return description ?? ''
  }

  const defaultLocale = config.i18n?.defaultLocale ?? 'en'

  return description[locale] ?? description[defaultLocale] ?? ''
}
