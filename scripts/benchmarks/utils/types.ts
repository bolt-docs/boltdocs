import type { Bench } from 'tinybench'

export interface BenchmarkSuite {
  name: string
  description: string
  run: () => Promise<SuiteResult>
}

export interface BenchmarkResult {
  suite: string
  task: string
  latency: {
    mean: number
    median: number
    min: number
    max: number
    p75: number
    p995: number
    p99: number
    p999: number
    rme: number
    sd: number
    sem: number
    variance: number
    cv: number
  }
  throughput: {
    mean: number
    median: number
  }
  samples: number
}

export interface BenchmarkRunResult {
  id: string
  timestamp: string
  suites: SuiteResult[]
  environment: EnvironmentInfo
}

export interface SuiteResult {
  name: string
  tasks: BenchmarkResult[]
  duration: number
}

export interface EnvironmentInfo {
  nodeVersion: string
  platform: string
  arch: string
  cpuModel: string
  cpuCores: number
  totalMemory: string
}

export interface BenchmarkConfig {
  time: number
  iterations: number
  warmupIterations: number
  warmupTime: number
  outputFile?: string
  suites?: string[]
}

export function collectSuiteResult(
  suiteName: string,
  bench: Bench,
  duration: number,
): SuiteResult {
  const tasks: BenchmarkResult[] = []

  for (const task of bench.tasks) {
    if (
      task.result &&
      (task.result.state === 'completed' ||
        task.result.state === 'aborted-with-statistics')
    ) {
      const mean = task.result.latency.mean
      const sd = task.result.latency.sd
      tasks.push({
        suite: suiteName,
        task: task.name,
        latency: {
          mean,
          median: task.result.latency.p50,
          min: task.result.latency.min,
          max: task.result.latency.max,
          p75: task.result.latency.p75,
          p995: task.result.latency.p995,
          p99: task.result.latency.p99,
          p999: task.result.latency.p999,
          rme: task.result.latency.rme,
          sd,
          sem: task.result.latency.sem,
          variance: task.result.latency.variance,
          cv: mean === 0 ? 0 : (sd / mean) * 100,
        },
        throughput: {
          mean: task.result.throughput.mean,
          median: task.result.throughput.p50,
        },
        samples: task.result.latency.samplesCount,
      })
    }
  }

  return { name: suiteName, tasks, duration }
}
