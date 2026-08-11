import { useRef } from 'react'
import {
  useScrollAnimation,
  useScrollStagger,
} from '../../src/hooks/useScrollAnimation'
import { NoiseOverlay } from '../../src/components/ui/noise-overlay'
import rawBenchmarkData from '../../src/data/benchmark-results.json'
import type {
  BenchmarkData,
  BenchmarkMetric,
} from '../../src/components/benchmark/types'
import { BarChart } from '../../src/components/benchmark/bar-chart'
import { Zap, Timer, RotateCcw, HardDrive } from 'lucide-react'

type AggregateMetric = {
  samples?: number[]
  median?: number
  mean?: number
  min?: number
  max?: number
}

type RawMetric = {
  boltdocs?: number | AggregateMetric
  docusaurus?: number | AggregateMetric
  ratio?: number
}

type BenchmarkRecord = {
  pageCount?: number
  timestamp?: string
  metrics?: Record<string, RawMetric | undefined>
  [key: string]: unknown
}

function aggregateValue(value: number | AggregateMetric | undefined): number {
  if (typeof value === 'number') return value
  if (!value) return 0
  return value.median ?? value.mean ?? value.samples?.[0] ?? value.min ?? 0
}

function normalizeMetric(value: RawMetric | undefined): BenchmarkMetric {
  if (!value) return { boltdocs: 0, docusaurus: 0, ratio: 0 }

  const boltdocs = aggregateValue(value.boltdocs)
  const docusaurus = aggregateValue(value.docusaurus)
  const ratio =
    typeof value.ratio === 'number'
      ? value.ratio
      : boltdocs > 0
        ? docusaurus / boltdocs
        : 0

  return { boltdocs, docusaurus, ratio }
}

function normalizeBenchmarkData(raw: BenchmarkRecord): BenchmarkData {
  const source = raw.metrics ?? raw
  return {
    pageCount: raw.pageCount ?? 0,
    timestamp: raw.timestamp ?? new Date(0).toISOString(),
    buildTimeCold: normalizeMetric(
      source.buildTimeCold as RawMetric | undefined,
    ),
    buildTimeWarm: normalizeMetric(
      source.buildTimeWarm as RawMetric | undefined,
    ),
    buildTimeEditedRebuild: source.buildTimeEditedRebuild
      ? normalizeMetric(source.buildTimeEditedRebuild as RawMetric)
      : undefined,
    devServerStart: normalizeMetric(
      source.devServerStart as RawMetric | undefined,
    ),
    bundleSize: normalizeMetric(source.bundleSize as RawMetric | undefined),
  }
}

const benchmarkData = normalizeBenchmarkData(
  rawBenchmarkData as BenchmarkRecord,
)

const metrics = [
  {
    key: 'buildTimeCold' as const,
    label: 'Cold Build Time',
    icon: Zap,
    suffix: 's',
    boltdocsVal: benchmarkData.buildTimeCold.boltdocs,
    docusaurusVal: benchmarkData.buildTimeCold.docusaurus,
    ratio: benchmarkData.buildTimeCold.ratio,
    description: 'Full build from scratch with no cache.',
  },
  {
    key: 'buildTimeWarm' as const,
    label: 'Warm Build',
    icon: RotateCcw,
    suffix: 's',
    boltdocsVal: benchmarkData.buildTimeWarm.boltdocs,
    docusaurusVal: benchmarkData.buildTimeWarm.docusaurus,
    ratio: benchmarkData.buildTimeWarm.ratio,
    description: 'Repeat build with identical inputs and existing caches.',
  },
  ...(benchmarkData.buildTimeEditedRebuild
    ? [
        {
          key: 'buildTimeEditedRebuild' as const,
          label: 'Edited Rebuild',
          icon: RotateCcw,
          suffix: 's',
          boltdocsVal: benchmarkData.buildTimeEditedRebuild.boltdocs,
          docusaurusVal: benchmarkData.buildTimeEditedRebuild.docusaurus,
          ratio: benchmarkData.buildTimeEditedRebuild.ratio,
          description: 'Full CLI build after editing one input; not HMR.',
        },
      ]
    : []),
  {
    key: 'devServerStart' as const,
    label: 'Dev Server Startup',
    icon: Timer,
    suffix: 'ms',
    boltdocsVal: benchmarkData.devServerStart.boltdocs,
    docusaurusVal: benchmarkData.devServerStart.docusaurus,
    ratio: benchmarkData.devServerStart.ratio,
    description: 'Time until dev server is ready to serve.',
  },
  {
    key: 'bundleSize' as const,
    label: 'Output Size',
    icon: HardDrive,
    suffix: 'KB',
    boltdocsVal: benchmarkData.bundleSize.boltdocs,
    docusaurusVal: benchmarkData.bundleSize.docusaurus,
    ratio: benchmarkData.bundleSize.ratio,
    description: 'Total size of the production build output.',
  },
]

function MetricCard({ metric }: { metric: (typeof metrics)[number] }) {
  const cardRef = useRef<HTMLDivElement>(null)
  const Icon = metric.icon

  const max = Math.max(metric.boltdocsVal, metric.docusaurusVal, 1)
  const boltdocsWidth = (metric.boltdocsVal / max) * 100
  const docusaurusWidth = (metric.docusaurusVal / max) * 100
  const isBetter = metric.boltdocsVal < metric.docusaurusVal

  return (
    <div
      ref={cardRef}
      className="p-6 rounded-2xl bg-surface/50 border border-subtle backdrop-blur-xl hover:border-primary-500/20 transition-all duration-300"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary-500/10 text-primary-500">
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-body">{metric.label}</h3>
          <p className="text-xs text-body/50">{metric.description}</p>
        </div>
        <span
          className={`px-3 py-1 text-xs font-bold rounded-full border ${
            isBetter
              ? 'text-primary-600 dark:text-primary-500 bg-primary-500/10 border-primary-500/20'
              : 'text-rose-600 dark:text-rose-500 bg-rose-500/10 border-rose-500/20'
          }`}
        >
          {metric.boltdocsVal}
          {metric.suffix}
        </span>
      </div>

      <BarChart
        items={[
          {
            label: 'Boltdocs',
            value: `${metric.key === 'bundleSize' ? (metric.boltdocsVal / 1024).toFixed(1) : metric.boltdocsVal}${metric.suffix}`,
            width: boltdocsWidth,
            color: 'bg-primary-500 shadow-[0_0_12px_rgba(235,88,40,0.5)]',
            labelColor: 'text-primary-600 dark:text-primary-500 font-bold',
          },
          {
            label: 'Docusaurus',
            value: `${metric.key === 'bundleSize' ? (metric.docusaurusVal / 1024).toFixed(1) : metric.docusaurusVal}${metric.suffix}`,
            width: docusaurusWidth,
            color: 'bg-dim/50',
          },
        ]}
      />
    </div>
  )
}

export default function BenchmarkPage() {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const subtitleRef = useRef<HTMLParagraphElement>(null)
  const statsRef = useRef<HTMLDivElement>(null)
  const cardsRef = useRef<HTMLDivElement>(null)

  useScrollAnimation(titleRef, 'fade-up')
  useScrollAnimation(subtitleRef, 'fade-up')
  useScrollStagger(statsRef, { stagger: 0.08 })
  useScrollStagger(cardsRef, { stagger: 0.12 })

  const comparableMetrics = metrics.filter(
    (m) =>
      m.key === 'buildTimeCold' ||
      m.key === 'buildTimeWarm' ||
      m.key === 'buildTimeEditedRebuild',
  )
  const avgRatio =
    comparableMetrics.length > 0
      ? comparableMetrics.reduce((acc, m) => acc + m.ratio, 0) /
        comparableMetrics.length
      : 0

  return (
    <div className="font-sans antialiased min-h-screen bg-main text-body flex flex-col justify-start relative">
      <NoiseOverlay />
      <section className="relative py-24 px-6 w-full overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary-400/10 via-main to-main" />
        </div>
        <div className="max-w-4xl mx-auto text-center">
          <h1
            ref={titleRef}
            className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tighter text-body mb-6"
          >
            Performance Benchmarks
          </h1>
          <p
            ref={subtitleRef}
            className="text-lg md:text-xl text-body/70 max-w-2xl mx-auto leading-relaxed"
          >
            Build times, dev server startup, and output size across{' '}
            {benchmarkData.pageCount} pages — measured under identical
            conditions.
          </p>
        </div>
      </section>

      <section className="px-6 pb-16">
        <div
          ref={statsRef}
          className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4"
        >
          <div className="p-5 rounded-2xl bg-surface/50 border border-subtle backdrop-blur-xl text-center">
            <Zap className="w-5 h-5 text-primary-500 mx-auto mb-2" />
            <div className="text-2xl md:text-3xl font-black text-body">
              {benchmarkData.buildTimeCold.boltdocs}s
            </div>
            <div className="text-xs text-body/50 mt-1 font-medium">
              Boltdocs Build Time
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-surface/50 border border-subtle backdrop-blur-xl text-center">
            <Timer className="w-5 h-5 text-primary-500 mx-auto mb-2" />
            <div className="text-2xl md:text-3xl font-black text-body">
              {benchmarkData.devServerStart.boltdocs}ms
            </div>
            <div className="text-xs text-body/50 mt-1 font-medium">
              Dev Server Start
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-surface/50 border border-subtle backdrop-blur-xl text-center">
            <RotateCcw className="w-5 h-5 text-primary-500 mx-auto mb-2" />
            <div className="text-2xl md:text-3xl font-black text-body">
              {benchmarkData.buildTimeWarm.boltdocs}s
            </div>
            <div className="text-xs text-body/50 mt-1 font-medium">
              Warm Build
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-surface/50 border border-subtle backdrop-blur-xl text-center">
            <HardDrive className="w-5 h-5 text-primary-500 mx-auto mb-2" />
            <div className="text-2xl md:text-3xl font-black text-body">
              {(benchmarkData.bundleSize.boltdocs / 1024).toFixed(1)}MB
            </div>
            <div className="text-xs text-body/50 mt-1 font-medium">
              Output Size
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div
          ref={cardsRef}
          className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          {metrics.map((metric) => (
            <MetricCard key={metric.key} metric={metric} />
          ))}
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-3xl mx-auto p-8 rounded-3xl bg-surface/50 border border-subtle backdrop-blur-xl">
          <h2 className="text-xl font-bold text-body mb-4">Methodology</h2>
          <div className="space-y-3 text-sm text-body/70 leading-relaxed">
            <p>
              Each benchmark generates{' '}
              <strong className="text-body">
                {benchmarkData.pageCount} identical Markdown pages
              </strong>{' '}
              with frontmatter, headings, code blocks, and links. Both
              frameworks receive the exact same content.
            </p>
            <p>
              <strong className="text-body">Cold Build:</strong> Full build from
              scratch with no cache.{' '}
              <strong className="text-body">Warm Build:</strong> Repeated build
              with identical inputs and existing caches.{' '}
              <strong className="text-body">Edited Rebuild:</strong> Full CLI
              build after changing one input; this is not HMR.{' '}
              <strong className="text-body">Dev Server:</strong> Time until the
              dev server is ready.{' '}
              <strong className="text-body">Output Size:</strong> Total size of
              the production build directory.
            </p>
            <p>
              Average Docusaurus/Boltdocs speed ratio across timed build
              scenarios:{' '}
              <strong className="text-body">{avgRatio.toFixed(1)}×</strong>.
            </p>
            <p>
              All measurements are taken on the same machine under identical
              conditions. Cache directories are cleared between cold builds.
            </p>
            <p className="text-xs text-body/40 mt-4">
              Last measured:{' '}
              {new Date(benchmarkData.timestamp).toISOString().slice(0, 10)}
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
