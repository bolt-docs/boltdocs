import type { BenchmarkData } from './types'
import { BenchmarkCard } from './benchmark-card'
import { BarChart } from './bar-chart'
import { Zap } from 'lucide-react'

interface BuildSpeedCardProps {
  data: BenchmarkData
}

export const BuildSpeedCard = ({ data }: BuildSpeedCardProps) => {
  const maxCold = Math.max(
    data.buildTimeCold.boltdocs,
    data.buildTimeCold.docusaurus,
  )
  const boltdocsWidth = (data.buildTimeCold.boltdocs / maxCold) * 100
  const docusaurusWidth = (data.buildTimeCold.docusaurus / maxCold) * 100

  return (
    <BenchmarkCard>
      <div>
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary-500/10 text-primary-500">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-body">
              Build Speed ({data.pageCount} pages)
            </h3>
          </div>
          <span className="px-3 py-1 text-xs font-bold text-primary-600 dark:text-primary-500 bg-primary-500/10 rounded-full border border-primary-500/20">
            {data.buildTimeCold.boltdocs}s
          </span>
        </div>

        <BarChart
          items={[
            {
              label: 'Boltdocs (Vite + SSG)',
              value: `${data.buildTimeCold.boltdocs}s`,
              width: boltdocsWidth,
              color: 'bg-primary-500 shadow-[0_0_12px_rgba(235,88,40,0.5)]',
              labelColor: 'text-primary-600 dark:text-primary-500 font-bold',
            },
            {
              label: 'Docusaurus',
              value: `${data.buildTimeCold.docusaurus}s`,
              width: docusaurusWidth,
              color: 'bg-dim/50',
            },
          ]}
        />
      </div>
      <p className="text-sm text-body/60 mt-4 leading-relaxed">
        Vite coupled with parallelized route building generates static output
        efficiently, slashing wait times on CI/CD pipelines.
      </p>
    </BenchmarkCard>
  )
}
