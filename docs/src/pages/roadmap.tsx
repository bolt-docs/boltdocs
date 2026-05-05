import { CheckCircle2, Clock, Inbox, TrendingUp } from 'lucide-react'
import { FEATURES } from '../roadmap/list-features'
import { Feature } from '../roadmap/feature'
import { FeatureEmpty } from '../roadmap/feature-empty'

const statusConfig = {
  planned: {
    id: 'backlog',
    label: 'Backlog',
    icon: Inbox,
    color: 'text-body/40',
    borderColor: 'border-white/5',
    dotColor: 'bg-white/20',
  },
  'in-progress': {
    id: 'in-progress',
    label: 'In Progress',
    icon: Clock,
    color: 'text-blue-400',
    borderColor: 'border-blue-400/20',
    dotColor: 'bg-blue-400',
  },
  completed: {
    id: 'to-release',
    label: 'To Release',
    icon: TrendingUp,
    color: 'text-emerald-400',
    borderColor: 'border-emerald-400/20',
    dotColor: 'bg-emerald-400',
  },
  released: {
    id: 'done',
    label: 'Done',
    icon: CheckCircle2,
    color: 'text-purple-400',
    borderColor: 'border-purple-400/20',
    dotColor: 'bg-purple-400',
  },
}

export default function Roadmap() {
  const groupedFeatures = {
    planned: FEATURES.filter(f => f.status === 'planned'),
    'in-progress': FEATURES.filter(f => f.status === 'in-progress'),
    completed: FEATURES.filter(f => f.status === 'completed'),
    released: FEATURES.filter(f => f.status === 'released'),
  }

  return (
    <div className="min-h-screen bg-main font-sans antialiased overflow-x-hidden selection:bg-primary-500/30 text-body pb-20">
      <main className="w-full max-w-[1400px] mx-auto px-6">
        <header className="flex flex-col justify-between py-12 mb-4">
          <h1 className="text-3xl font-black tracking-tight">Roadmap</h1>
          <p className="text-body/60">Here you can see what we are working on and what we plan to do in the future.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
          {(Object.entries(statusConfig) as [keyof typeof groupedFeatures, typeof statusConfig['planned']][]).map(([statusKey, config]) => {
            const features = groupedFeatures[statusKey]
            const Icon = config.icon

            return (
              <div key={statusKey} className="flex flex-col gap-4">
                {/* Column Header */}
                <div className="flex items-center justify-between px-1">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-text-body/5 border border-text-body/10`}>
                    <Icon className={`size-3.5 ${config.color}`} />
                    <span className="text-[11px] font-bold uppercase tracking-widest">{config.label}</span>
                  </div>
                  <span className="text-xs font-bold text-body/20 pr-1">{features.length}</span>
                </div>

                {/* Column Content */}
                <div className="flex flex-col gap-3 min-h-[500px]">
                  {features.length > 0 ? (
                    features.map((feature, idx) => (
                      <Feature key={idx} feature={feature} />
                    ))
                  ) : (
                    <FeatureEmpty label={config.label} />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </main>
    </div>
  )
}