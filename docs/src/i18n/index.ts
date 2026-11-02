import { translations } from '@/i18n/translations'
import { useI18n } from '@bdocs/runtime'

export function useTranslations() {
  const { currentLocale } = useI18n()
  const locale = currentLocale === 'es' ? 'es' : 'en'
  return translations[locale]
}
