import { useRef } from 'react'
import { Code2, Component, FileText, Zap } from 'lucide-react'
import { useGSAPScroll, useGSAPStaggerIn } from './hooks/useGSAPScroll'

const STATS = [
  {
    icon: <Zap className="w-5 h-5" />,
    value: 'v2.6.2',
    label: 'Latest Version',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
  },
  {
    icon: <Component className="w-5 h-5" />,
    value: '15+',
    label: 'Components',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
  },
  {
    icon: <Code2 className="w-5 h-5" />,
    value: 'MDX',
    label: 'Support',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
  },
  {
    icon: <FileText className="w-5 h-5" />,
    value: 'Local',
    label: 'Search Built-in',
    color: 'text-pink-400',
    bgColor: 'bg-pink-400/10',
  },
]

export const StatsSection = () => {
  const statsRef = useRef<HTMLDivElement>(null)

  useGSAPStaggerIn(statsRef, { stagger: 0.1, duration: 0.5, y: 20 })

  return (
    <section className="py-10 px-6 border-y border-white/5 bg-surface/30">
      <div className="max-w-5xl mx-auto">
        <div ref={statsRef} className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((stat, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center text-center group"
            >
              <div
                className={`p-3 rounded-xl ${stat.bgColor} ${stat.color} mb-3 group-hover:scale-110 transition-transform duration-300`}
              >
                {stat.icon}
              </div>
              <span className="text-2xl md:text-3xl font-black text-body">
                {stat.value}
              </span>
              <span className="text-xs md:text-sm font-medium opacity-70 tracking-wider">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
