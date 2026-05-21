import { useRef } from 'react'
import { Code2, Zap, Search, Award } from 'lucide-react'
import { useGSAPStaggerIn } from './hooks/useGSAPScroll'
import { latest } from './data/version.json'

const STATS = [
  {
    icon: <Zap className="w-5 h-5" />,
    value: 'SSG',
    label: 'Static Engine',
    color: 'text-primary-500',
    bgColor: 'bg-primary-500/10',
  },
  {
    icon: <Code2 className="w-5 h-5" />,
    value: 'MDX',
    label: 'React & MDX Native',
    color: 'text-primary-400',
    bgColor: 'bg-primary-400/10',
  },
  {
    icon: <Search className="w-5 h-5" />,
    value: 'Local',
    label: 'Fast Search',
    color: 'text-primary-300',
    bgColor: 'bg-primary-300/10',
  },
  {
    icon: <Award className="w-5 h-5" />,
    value: `v${latest}`,
    label: 'Latest Version',
    color: 'text-primary-500',
    bgColor: 'bg-primary-500/10',
  },
]

export const StatsSection = () => {
  const statsRef = useRef<HTMLDivElement>(null)

  useGSAPStaggerIn(statsRef, { stagger: 0.1, duration: 0.5, y: 20 })

  return (
    <section className="py-16 px-6 border-y border-white/5 bg-surface/10 relative overflow-hidden">
      {/* Decorative subtle gradient behind */}
      <div className="absolute -left-1/4 top-1/2 -translate-y-1/2 w-96 h-96 bg-primary-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute -right-1/4 top-1/2 -translate-y-1/2 w-96 h-96 bg-primary-500/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto">
        <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((stat, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center text-center p-8 rounded-2xl bg-white/[0.02] border border-white/5 backdrop-blur-md hover:border-primary-500/20 hover:bg-white/[0.04] transition-all duration-300 group"
            >
              <div
                className={`p-3.5 rounded-xl ${stat.bgColor} ${stat.color} mb-4 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300`}
              >
                {stat.icon}
              </div>
              <span className="text-3xl md:text-4xl font-extrabold text-body tracking-tight mb-2">
                {stat.value}
              </span>
              <span className="text-xs md:text-sm font-semibold text-body/60 tracking-wider uppercase">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
