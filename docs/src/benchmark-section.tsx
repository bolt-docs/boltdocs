import { useRef } from 'react'
import { useScrollAnimation } from './hooks/useScrollAnimation'
import benchmarkData from './data/benchmark-results.json'
import { BuildSpeedCard } from './benchmark/build-speed-card'
import { PerformanceTable } from './benchmark/performance-table'

export const BenchmarkSection = () => {
  const containerRef = useRef<HTMLDivElement>(null)

  useScrollAnimation(containerRef, 'fade-up')

  return (
    <section className="py-24 px-6 bg-surface/5">
      <div className="max-w-6xl mx-auto" ref={containerRef}>
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black text-body mb-6 tracking-tight">
            Performance Benchmarks
          </h2>
          <p className="text-lg text-body/70 max-w-2xl mx-auto font-medium">
            Real-world benchmarks showing build times, dev server startup, and
            output size across {benchmarkData.pageCount} pages.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          <BuildSpeedCard data={benchmarkData} />
        </div>

        <PerformanceTable data={benchmarkData} />
      </div>
    </section>
  )
}
