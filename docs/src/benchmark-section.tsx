import { useRef } from 'react'
import { Zap, Clock, Settings, Puzzle, Check, AlertCircle } from 'lucide-react'
import { useGSAPScroll } from './hooks/useGSAPScroll'

export const BenchmarkSection = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAPScroll(containerRef, {
    animation: 'fade-up',
    delay: 0.1,
    duration: 0.8,
  })

  return (
    <section className="py-24 px-6 relative overflow-hidden bg-surface/5">
      {/* Dynamic blurred background accents */}
      <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-primary-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-primary-500/5 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto" ref={containerRef}>
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-body mb-6 tracking-tight">
            Boltdocs vs Docusaurus
          </h2>
          <p className="text-lg text-body/70 max-w-2xl mx-auto font-medium">
            See why modern developers and teams are choosing Boltdocs for a faster, zero-config, and highly graphical doc experience.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Card 1: Build Speed */}
          <div className="flex flex-col justify-between p-8 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-xl hover:border-primary-500/20 hover:bg-white/[0.04] transition-all duration-300 group animate-fade-in">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary-500/10 text-primary-500">
                    <Zap className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-body">Build Speed (100 pages)</h3>
                </div>
                <span className="px-3 py-1 text-xs font-bold text-primary-500 bg-primary-500/10 rounded-full border border-primary-500/20 animate-pulse">
                  3.4x Faster
                </span>
              </div>
              
              <div className="space-y-5 my-6">
                <div>
                  <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-body/60 mb-1.5">
                    <span>Boltdocs (Vite + Turborepo)</span>
                    <span className="text-primary-500 font-bold">2.5s</span>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-primary-500 rounded-full w-[29%] shadow-[0_0_12px_rgba(235,88,40,0.5)] transition-all duration-1000 group-hover:w-[29%]" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-body/40 mb-1.5">
                    <span>Docusaurus (Webpack)</span>
                    <span>8.5s</span>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-white/20 rounded-full w-[100%]" />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-sm text-body/60 mt-4 leading-relaxed">
              Vite coupled with Turborepo workspace caching generates static output in parallel, slashing wait times on CI/CD pipelines.
            </p>
          </div>

          {/* Card 2: HMR Latency */}
          <div className="flex flex-col justify-between p-8 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-xl hover:border-primary-500/20 hover:bg-white/[0.04] transition-all duration-300 group animate-fade-in">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary-500/10 text-primary-500">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-body">Dev Server HMR</h3>
                </div>
                <span className="px-3 py-1 text-xs font-bold text-primary-500 bg-primary-500/10 rounded-full border border-primary-500/20 animate-pulse">
                  Instant
                </span>
              </div>

              <div className="space-y-5 my-6">
                <div>
                  <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-body/60 mb-1.5">
                    <span>Boltdocs (ESModules HMR)</span>
                    <span className="text-primary-500 font-bold">&lt; 50ms</span>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-primary-500 rounded-full w-[5%] shadow-[0_0_12px_rgba(235,88,40,0.5)]" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-body/40 mb-1.5">
                    <span>Docusaurus (Webpack Dev)</span>
                    <span>~ 900ms</span>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-white/20 rounded-full w-[90%]" />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-sm text-body/60 mt-4 leading-relaxed">
              Native ES module hot updates bypass module bundling entirely, rendering changes in the browser almost instantly.
            </p>
          </div>

          {/* Card 3: Configuration Complexity */}
          <div className="flex flex-col justify-between p-8 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-xl hover:border-primary-500/20 hover:bg-white/[0.04] transition-all duration-300 group animate-fade-in">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary-500/10 text-primary-500">
                    <Settings className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-body">Required Configuration</h3>
                </div>
                <span className="px-3 py-1 text-xs font-bold text-primary-500 bg-primary-500/10 rounded-full border border-primary-500/20">
                  Zero Config
                </span>
              </div>

              <div className="space-y-5 my-6">
                <div>
                  <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-body/60 mb-1.5">
                    <span>Boltdocs (config.ts)</span>
                    <span className="text-primary-500 font-bold">1 line setup</span>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-primary-500 rounded-full w-[2%] shadow-[0_0_12px_rgba(235,88,40,0.5)]" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-body/40 mb-1.5">
                    <span>Docusaurus (docusaurus.config.js)</span>
                    <span>60+ lines</span>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-white/20 rounded-full w-[80%]" />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-sm text-body/60 mt-4 leading-relaxed">
              Start writing right away. Sensible defaults handle styling, routing, and search. Fine-tune details only when you need to.
            </p>
          </div>

          {/* Card 4: Architecture Integration */}
          <div className="flex flex-col justify-between p-8 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-xl hover:border-primary-500/20 hover:bg-white/[0.04] transition-all duration-300 group animate-fade-in">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary-500/10 text-primary-500">
                    <Puzzle className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-body">Component Customization</h3>
                </div>
                <span className="px-3 py-1 text-xs font-bold text-primary-500 bg-primary-500/10 rounded-full border border-primary-500/20">
                  Native React
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 my-6">
                <div className="p-4 rounded-2xl bg-primary-500/5 border border-primary-500/10">
                  <div className="flex items-center gap-2 mb-2 text-primary-500 font-bold text-sm">
                    <Check className="w-4 h-4" />
                    <span>Boltdocs</span>
                  </div>
                  <p className="text-xs text-body/70 leading-relaxed">
                    Import and place standard React/Vite components natively in markdown. Direct prop rendering.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5">
                  <div className="flex items-center gap-2 mb-2 text-body/40 font-bold text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>Docusaurus</span>
                  </div>
                  <p className="text-xs text-body/50 leading-relaxed">
                    Requires complex component swizzling and custom configuration files to override default layouts.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-body/60 mt-2 leading-relaxed">
              No extra setup. Standard JSX and TypeScript component mapping works natively directly within MDX files.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
