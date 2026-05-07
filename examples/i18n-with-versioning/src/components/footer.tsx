import { useI18n } from 'boltdocs/client'

const locale = {
  en: '@2026 BoltDocs. All rights reserved.',
  es: '@2026 BoltDocs. Todos los derechos reservados.',
}

export function Footer() {
  const { currentLocale } = useI18n()
  return <footer>{locale[currentLocale ?? 'en']}</footer>
}
