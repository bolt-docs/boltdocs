import { Card, Cards, useI18n } from 'boltdocs/client'
import { Route, FileText, Settings, Sparkles } from 'lucide-react'

const features = [
  {
    title: {
      en: 'File-route',
      es: 'Rutas de archivos',
    },
    description: {
      en: 'Generate routes from file structure.',
      es: 'Genera rutas a partir de la estructura de archivos.',
    },
    Icon: Route,
  },
  {
    title: {
      en: 'Markdown',
      es: 'Markdown',
    },
    description: {
      en: 'Support Markdown for writing documentation.',
      es: 'Soporte de Markdown para escribir documentación.',
    },
    Icon: FileText,
  },
  {
    title: {
      en: 'Customizable',
      es: 'Personalizable',
    },
    description: {
      en: 'Customizable to your needs.',
      es: 'Personalizable a tus necesidades.',
    },
    Icon: Settings,
  },
  {
    title: {
      en: 'Secure by design',
      es: 'Seguro por diseño',
    },
    description: {
      en: 'Boltdocs is secure by design.',
      es: 'Boltdocs es seguro por diseño.',
    },
    Icon: Sparkles,
  },
]

export function HomePage() {
  const { currentLocale } = useI18n()
  return (
    <div className="w-full h-[calc(100vh-120px)] flex items-center gap-10">
      <div className="flex flex-col justify-center py-10">
        <h1 className="text-5xl font-extrabold">
          Power by <p className="text-purple-500 inline">Boltdocs</p>
        </h1>
        <p className="text-xl mt-4 text-muted">Docs generators for react.</p>
      </div>
      <Cards cols={4}>
        {features.map((feature) => (
          <Card
            key={feature.title.en}
            title={feature.title[currentLocale as keyof typeof feature.title]}
            icon={<feature.Icon />}
          >
            {
              feature.description[
                currentLocale as keyof typeof feature.description
              ]
            }
          </Card>
        ))}
      </Cards>
    </div>
  )
}
