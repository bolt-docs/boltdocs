import { Card, Cards, useI18n } from 'boltdocs/client'
import { Route, FileText, Settings, Sparkles } from 'lucide-react'

const content = {
  en: {
    title: 'Powered by',
    subtitle: 'Docs generator for React.',
    features: [
      {
        title: 'File-route',
        description: 'Generate routes from file structure.',
        Icon: Route,
      },
      {
        title: 'Markdown',
        description: 'Support Markdown for writing documentation.',
        Icon: FileText,
      },
      {
        title: 'Customizable',
        description: 'Customizable to your needs.',
        Icon: Settings,
      },
      {
        title: 'Secure by design',
        description: 'Boltdocs is secure by design.',
        Icon: Sparkles,
      },
    ],
  },
  es: {
    title: 'Potenciado por',
    subtitle: 'Generador de documentación para React.',
    features: [
      {
        title: 'Rutas por archivos',
        description: 'Genera rutas desde la estructura de archivos.',
        Icon: Route,
      },
      {
        title: 'Markdown',
        description: 'Soporte para Markdown al escribir documentación.',
        Icon: FileText,
      },
      {
        title: 'Personalizable',
        description: 'Personalizable según tus necesidades.',
        Icon: Settings,
      },
      {
        title: 'Seguro por diseño',
        description: 'Boltdocs es seguro por diseño.',
        Icon: Sparkles,
      },
    ],
  },
}

export function HomePage() {
  const { currentLocale } = useI18n()
  const locale = (currentLocale || 'en') as keyof typeof content
  const t = content[locale] || content.en

  return (
    <div className="w-full h-[calc(100vh-120px)] flex items-center gap-10">
      <div className="flex flex-col justify-center py-10 min-w-[400px]">
        <h1 className="text-5xl font-extrabold">
          {t.title} <p className="text-purple-500 inline">Boltdocs</p>
        </h1>
        <p className="text-xl mt-4 text-text-muted">{t.subtitle}</p>
      </div>
      <Cards cols={4}>
        {t.features.map((feature) => (
          <Card
            key={feature.title}
            title={feature.title}
            icon={<feature.Icon />}
          >
            {feature.description}
          </Card>
        ))}
      </Cards>
    </div>
  )
}
