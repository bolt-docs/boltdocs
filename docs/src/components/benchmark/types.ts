export interface BenchmarkMetric {
  boltdocs: number
  docusaurus: number
  ratio: number
}

export interface BenchmarkData {
  pageCount: number
  timestamp: string
  buildTimeCold: BenchmarkMetric
  buildTimeWarm: BenchmarkMetric
  /** Full CLI build after editing one input; not HMR timing. */
  buildTimeEditedRebuild?: BenchmarkMetric
  devServerStart: BenchmarkMetric
  bundleSize: BenchmarkMetric
}

export type DiffType = 'time' | 'size'
