import { useRef } from 'react'
import { Zap, Clock, Settings, Puzzle, Check, AlertCircle } from 'lucide-react'
import { useGSAPScroll } from './hooks/useGSAPScroll'
import benchmarkData from './data/benchmark-results.json'

export const BenchmarkSection = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAPScroll(containerRef, {
    animation: 'fade-up',
    delay: 0.1,
    duration: 0.8,
  })

  const maxCold = Math.max(
    benchmarkData.buildTimeCold.boltdocs,
    benchmarkData.buildTimeCold.docusaurus,
  )
  const boltdocsColdWidth =
    (benchmarkData.buildTimeCold.boltdocs / maxCold) * 100
  const docusaurusColdWidth =
    (benchmarkData.buildTimeCold.docusaurus / maxCold) * 100

  const maxDev = Math.max(
    benchmarkData.devServerStart.boltdocs,
    benchmarkData.devServerStart.docusaurus,
  )
  const boltdocsDevWidth =
    (benchmarkData.devServerStart.boltdocs / maxDev) * 100
  const docusaurusDevWidth =
    (benchmarkData.devServerStart.docusaurus / maxDev) * 100

  const formatDiff = (
    boltdocsVal: number,
    docusaurusVal: number,
    type: 'time' | 'size',
  ) => {
    if (boltdocsVal < docusaurusVal) {
      const ratio = (docusaurusVal / boltdocsVal).toFixed(1)
      const text = type === 'time' ? 'faster' : 'lighter'
      return {
        text: `${ratio}x ${text}`,
        className: 'text-emerald-500 font-semibold',
      }
    } else {
      const ratio = (boltdocsVal / docusaurusVal).toFixed(1)
      const text = type === 'time' ? 'slower' : 'heavier'
      return {
        text: `${ratio}x ${text}`,
        className: 'text-rose-500 font-semibold',
      }
    }
  }

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
            See why modern developers and teams are choosing Boltdocs for a
            faster, zero-config, and highly graphical doc experience.
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
                  <h3 className="text-xl font-bold text-body">
                    Build Speed ({benchmarkData.pageCount} pages)
                  </h3>
                </div>
                <span className="px-3 py-1 text-xs font-bold text-primary-500 bg-primary-500/10 rounded-full border border-primary-500/20 animate-pulse">
                  {benchmarkData.buildTimeCold.ratio}x Faster
                </span>
              </div>

              <div className="space-y-5 my-6">
                <div>
                  <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-body/60 mb-1.5">
                    <span>Boltdocs (Vite + SSG)</span>
                    <span className="text-primary-500 font-bold">
                      {benchmarkData.buildTimeCold.boltdocs}s
                    </span>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-primary-500 rounded-full shadow-[0_0_12px_rgba(235,88,40,0.5)] transition-all duration-1000"
                      style={{ width: `${boltdocsColdWidth}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-body/40 mb-1.5">
                    <span>Docusaurus (Webpack)</span>
                    <span>{benchmarkData.buildTimeCold.docusaurus}s</span>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-white/20 rounded-full"
                      style={{ width: `${docusaurusColdWidth}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-sm text-body/60 mt-4 leading-relaxed">
              Vite coupled with parallelized route building generates static
              output efficiently, slashing wait times on CI/CD pipelines.
            </p>
          </div>

          {/* Card 2: Dev Server Startup */}
          <div className="flex flex-col justify-between p-8 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-xl hover:border-primary-500/20 hover:bg-white/[0.04] transition-all duration-300 group animate-fade-in">
            <div>
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-primary-500/10 text-primary-500">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-body">
                    Dev Server Startup
                  </h3>
                </div>
                <span className="px-3 py-1 text-xs font-bold text-primary-500 bg-primary-500/10 rounded-full border border-primary-500/20 animate-pulse">
                  {benchmarkData.devServerStart.ratio}x Faster
                </span>
              </div>

              <div className="space-y-5 my-6">
                <div>
                  <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-body/60 mb-1.5">
                    <span>Boltdocs (ESModules Dev)</span>
                    <span className="text-primary-500 font-bold">
                      {benchmarkData.devServerStart.boltdocs}ms
                    </span>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-primary-500 rounded-full shadow-[0_0_12px_rgba(235,88,40,0.5)]"
                      style={{ width: `${boltdocsDevWidth}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-body/40 mb-1.5">
                    <span>Docusaurus (Webpack Dev)</span>
                    <span>{benchmarkData.devServerStart.docusaurus}ms</span>
                  </div>
                  <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div
                      className="h-full bg-white/20 rounded-full"
                      style={{ width: `${docusaurusDevWidth}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-sm text-body/60 mt-4 leading-relaxed">
              Native ES module hot updates bypass module bundling entirely,
              starting the server instantly and rendering updates in
              milliseconds.
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
                  <h3 className="text-xl font-bold text-body">
                    Required Configuration
                  </h3>
                </div>
                <span className="px-3 py-1 text-xs font-bold text-primary-500 bg-primary-500/10 rounded-full border border-primary-500/20">
                  Zero Config
                </span>
              </div>

              <div className="space-y-5 my-6">
                <div>
                  <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-body/60 mb-1.5">
                    <span>Boltdocs (config.ts)</span>
                    <span className="text-primary-500 font-bold">
                      1 line setup
                    </span>
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
              Start writing right away. Sensible defaults handle styling,
              routing, and search. Fine-tune details only when you need to.
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
                  <h3 className="text-xl font-bold text-body">
                    Component Customization
                  </h3>
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
                    Import and place standard React/Vite components natively in
                    markdown. Direct prop rendering.
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5">
                  <div className="flex items-center gap-2 mb-2 text-body/40 font-bold text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>Docusaurus</span>
                  </div>
                  <p className="text-xs text-body/50 leading-relaxed">
                    Requires complex component swizzling and custom
                    configuration files to override default layouts.
                  </p>
                </div>
              </div>
            </div>
            <p className="text-sm text-body/60 mt-2 leading-relaxed">
              No extra setup. Standard JSX and TypeScript component mapping
              works natively directly within MDX files.
            </p>
          </div>
        </div>

        {/* Detailed Metrics Table */}
        <div className="mt-16 p-8 rounded-3xl bg-white/[0.02] border border-white/5 backdrop-blur-xl hover:border-primary-500/10 transition-all duration-300">
          <h3 className="text-xl font-bold text-body mb-6 flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-500" />
            Detailed Performance Metrics
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs font-semibold uppercase tracking-wider text-body/60">
                  <th className="py-4 px-4">Metric</th>
                  <th className="py-4 px-4 text-primary-500 font-bold">
                    Boltdocs
                  </th>
                  <th className="py-4 px-4 text-body/60">Docusaurus</th>
                  <th className="py-4 px-4 text-right">Difference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-body/80">
                <tr>
                  <td className="py-4 px-4 font-medium text-body">
                    Cold Build Time ({benchmarkData.pageCount} pages)
                  </td>
                  <td className="py-4 px-4 text-primary-500 font-bold">
                    {benchmarkData.buildTimeCold.boltdocs}s
                  </td>
                  <td className="py-4 px-4">
                    {benchmarkData.buildTimeCold.docusaurus}s
                  </td>
                  <td
                    className={`py-4 px-4 text-right ${formatDiff(benchmarkData.buildTimeCold.boltdocs, benchmarkData.buildTimeCold.docusaurus, 'time').className}`}
                  >
                    {
                      formatDiff(
                        benchmarkData.buildTimeCold.boltdocs,
                        benchmarkData.buildTimeCold.docusaurus,
                        'time',
                      ).text
                    }
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-medium text-body">
                    Warm Build / Rebuild (1 page edit)
                  </td>
                  <td className="py-4 px-4 text-primary-500 font-bold">
                    {benchmarkData.buildTimeWarm.boltdocs}s
                  </td>
                  <td className="py-4 px-4">
                    {benchmarkData.buildTimeWarm.docusaurus}s
                  </td>
                  <td
                    className={`py-4 px-4 text-right ${formatDiff(benchmarkData.buildTimeWarm.boltdocs, benchmarkData.buildTimeWarm.docusaurus, 'time').className}`}
                  >
                    {
                      formatDiff(
                        benchmarkData.buildTimeWarm.boltdocs,
                        benchmarkData.buildTimeWarm.docusaurus,
                        'time',
                      ).text
                    }
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-medium text-body">
                    Dev Server Startup
                  </td>
                  <td className="py-4 px-4 text-primary-500 font-bold">
                    {benchmarkData.devServerStart.boltdocs}ms
                  </td>
                  <td className="py-4 px-4">
                    {benchmarkData.devServerStart.docusaurus}ms
                  </td>
                  <td
                    className={`py-4 px-4 text-right ${formatDiff(benchmarkData.devServerStart.boltdocs, benchmarkData.devServerStart.docusaurus, 'time').className}`}
                  >
                    {
                      formatDiff(
                        benchmarkData.devServerStart.boltdocs,
                        benchmarkData.devServerStart.docusaurus,
                        'time',
                      ).text
                    }
                  </td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-medium text-body">
                    Production Output Size
                  </td>
                  <td className="py-4 px-4 text-primary-500 font-bold">
                    {benchmarkData.bundleSize.boltdocs} KB
                  </td>
                  <td className="py-4 px-4">
                    {benchmarkData.bundleSize.docusaurus} KB
                  </td>
                  <td
                    className={`py-4 px-4 text-right ${formatDiff(benchmarkData.bundleSize.boltdocs, benchmarkData.bundleSize.docusaurus, 'size').className}`}
                  >
                    {
                      formatDiff(
                        benchmarkData.bundleSize.boltdocs,
                        benchmarkData.bundleSize.docusaurus,
                        'size',
                      ).text
                    }
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-xs text-body/40 mt-4 italic text-right">
            Last measured: {new Date(benchmarkData.timestamp).toLocaleString()}
          </p>
        </div>
      </div>
    </section>
  )
}
