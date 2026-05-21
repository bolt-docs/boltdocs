import {
  GitBranch,
  Globe,
  Layers,
  Search,
  Tag,
  Puzzle,
  Code2,
} from 'lucide-react'
import { GoogleAnalytics } from './icons-integrations'

const INTEGRATIONS = [
  { name: 'Google Analytics 4', icon: <GoogleAnalytics className="w-5 h-5" /> },
  { name: 'Google Tag Manager', icon: <Tag className="w-5 h-5" /> },
  { name: 'Flexsearch', icon: <Search className="w-5 h-5" /> },
  { name: 'Mermaid Diagrams', icon: <Layers className="w-5 h-5" /> },
  { name: 'Shiki Syntax', icon: <Code2 className="w-5 h-5" /> },
  { name: 'Internationalization', icon: <Globe className="w-5 h-5" /> },
  { name: 'Versioning', icon: <GitBranch className="w-5 h-5" /> },
  { name: 'React / MDX', icon: <Puzzle className="w-5 h-5" /> },
]

export const Integrations = () => {
  return (
    <section className="py-20 overflow-hidden border-y border-white/5 dark:bg-black/20 relative">
      <div className="max-w-7xl mx-auto px-6 mb-10 relative z-20">
        <p className="text-center text-sm font-semibold tracking-wider uppercase text-primary-500">
          Integrations & Ecosystem
        </p>
        <h2 className="text-center text-3xl font-bold mt-2 text-body">
          Engineered to Integrate with Industry Standards
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

        {/* Gradient overlays for smooth fade */}
        <div className="absolute inset-y-0 left-0 w-40 bg-linear-to-r from-bg-main to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-40 bg-linear-to-l from-bg-main to-transparent z-10 pointer-events-none" />
      </div>
    </section>
  )
}
