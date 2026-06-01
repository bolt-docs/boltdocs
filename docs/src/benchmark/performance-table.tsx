import type { BenchmarkData, DiffType } from './types'
import { Settings } from 'lucide-react'

interface PerformanceTableProps {
  data: BenchmarkData
}

const formatDiff = (
  boltdocsVal: number,
  docusaurusVal: number,
  type: DiffType,
) => {
  if (boltdocsVal < docusaurusVal) {
    const ratio = (docusaurusVal / boltdocsVal).toFixed(1)
    const text = type === 'time' ? 'faster' : 'lighter'
    return {
      text: `${ratio}x ${text}`,
      className: 'text-emerald-600 dark:text-emerald-500 font-semibold',
    }
  }
  const ratio = (boltdocsVal / docusaurusVal).toFixed(1)
  const text = type === 'time' ? 'slower' : 'heavier'
  return {
    text: `${ratio}x ${text}`,
    className: 'text-rose-600 dark:text-rose-500 font-semibold',
  }
}

const rows = (data: BenchmarkData) => [
  {
    metric: `Cold Build Time (${data.pageCount} pages)`,
    boltdocs: `${data.buildTimeCold.boltdocs}s`,
    docusaurus: `${data.buildTimeCold.docusaurus}s`,
    diff: formatDiff(
      data.buildTimeCold.boltdocs,
      data.buildTimeCold.docusaurus,
      'time',
    ),
  },
  {
    metric: 'Warm Build / Rebuild (1 page edit)',
    boltdocs: `${data.buildTimeWarm.boltdocs}s`,
    docusaurus: `${data.buildTimeWarm.docusaurus}s`,
    diff: formatDiff(
      data.buildTimeWarm.boltdocs,
      data.buildTimeWarm.docusaurus,
      'time',
    ),
  },
  {
    metric: 'Dev Server Startup',
    boltdocs: `${data.devServerStart.boltdocs}ms`,
    docusaurus: `${data.devServerStart.docusaurus}ms`,
    diff: formatDiff(
      data.devServerStart.boltdocs,
      data.devServerStart.docusaurus,
      'time',
    ),
  },
  {
    metric: 'Production Output Size',
    boltdocs: `${data.bundleSize.boltdocs} KB`,
    docusaurus: `${data.bundleSize.docusaurus} KB`,
    diff: formatDiff(
      data.bundleSize.boltdocs,
      data.bundleSize.docusaurus,
      'size',
    ),
  },
]

export const PerformanceTable = ({ data }: PerformanceTableProps) => {
  const tableRows = rows(data)

  return (
    <div className="mt-16 p-8 rounded-3xl bg-surface/50 border border-subtle backdrop-blur-xl hover:border-primary-500/20 transition-all duration-300">
      <h3 className="text-xl font-bold text-body mb-6 flex items-center gap-2">
        <Settings className="w-5 h-5 text-primary-500" />
        Detailed Performance Metrics
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-subtle text-xs font-semibold uppercase tracking-wider text-body/60">
              <th className="py-4 px-4">Metric</th>
              <th className="py-4 px-4 text-primary-600 dark:text-primary-500 font-bold">
                Boltdocs
              </th>
              <th className="py-4 px-4 text-body/60">Docusaurus</th>
              <th className="py-4 px-4 text-right">Difference</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-subtle text-sm text-body/80">
            {tableRows.map((row, i) => (
              <tr
                key={i}
                className="hover:bg-surface/50 transition-colors duration-200"
              >
                <td className="py-4 px-4 font-medium text-body">
                  {row.metric}
                </td>
                <td className="py-4 px-4 text-primary-600 dark:text-primary-500 font-bold">
                  {row.boltdocs}
                </td>
                <td className="py-4 px-4">{row.docusaurus}</td>
                <td className={`py-4 px-4 text-right ${row.diff.className}`}>
                  {row.diff.text}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-body/40 mt-4 italic text-right">
        Last measured: {new Date(data.timestamp).toLocaleString()}
      </p>
    </div>
  )
}
