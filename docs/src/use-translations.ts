import { useI18n } from 'boltdocs/client'
import { translations } from './i18n-translations'

export function useTranslations() {
  const { currentLocale } = useI18n()
  const locale = currentLocale === 'es' ? 'es' : 'en'
  return translations[locale]
}
