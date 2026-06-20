import {
  GitBranch,
  Globe,
  Layers,
  Search,
  Tag,
  Palette,
  Code2,
  Image,
  MessageSquare,
  Sigma,
} from 'lucide-react'
import { NoiseOverlay } from './noise-overlay'
import { useTranslations } from './use-translations'

const INTEGRATIONS = [
  { name: 'React / MDX', icon: <Code2 className="w-5 h-5" /> },
  { name: 'FlexSearch', icon: <Search className="w-5 h-5" /> },
  { name: 'Open Graph', icon: <Image className="w-5 h-5" /> },
  { name: 'Mermaid', icon: <Layers className="w-5 h-5" /> },
  { name: 'Math', icon: <Sigma className="w-5 h-5" /> },
  { name: 'Shiki Syntax', icon: <Palette className="w-5 h-5" /> },
  { name: 'Feedback', icon: <MessageSquare className="w-5 h-5" /> },
  { name: 'i18n', icon: <Globe className="w-5 h-5" /> },
  { name: 'Google Analytics', icon: <Tag className="w-5 h-5" /> },
  { name: 'Versioning', icon: <GitBranch className="w-5 h-5" /> },
]

export const Integrations = () => {
  const t = useTranslations()
  return (
    <section className="py-20 overflow-hidden border-y border-subtle bg-main/60 relative">
      <NoiseOverlay />
      <div className="max-w-7xl mx-auto px-6 mb-10 relative z-20">
        <p className="text-center text-sm font-semibold tracking-wider uppercase text-primary-500">
          {t.integrationsLabel}
        </p>
        <h2 className="text-center text-3xl font-bold mt-2 text-body">
          {t.integrationsTitle}
        </h2>
      </div>

      <div className="relative flex overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap gap-6 items-center py-4">
          {[...INTEGRATIONS, ...INTEGRATIONS].map((item, i) => (
            <div
              key={`${item.name}-${i}`}
              className="flex items-center gap-3 px-5 py-3 opacity-80 hover:opacity-100 hover:scale-105 transition-all duration-300 group cursor-default bg-surface border border-subtle rounded-full shadow-xs"
            >
              <div className="text-muted group-hover:text-primary-500 transition-colors">
                {item.icon}
              </div>
              <span className="text-sm font-medium text-paragraph group-hover:text-body transition-colors">
                {item.name}
              </span>
            </div>
          ))}
        </div>

        <div className="absolute inset-y-0 left-0 w-40 bg-linear-to-r from-bg-main to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-40 bg-linear-to-l from-bg-main to-transparent z-10 pointer-events-none" />
      </div>
    </section>
  )
}
