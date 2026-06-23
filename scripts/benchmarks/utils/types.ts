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
    p75: number
    p99: number
    rme: number
    sd: number
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
      tasks.push({
        suite: suiteName,
        task: task.name,
        latency: {
          mean: task.result.latency.mean,
          median: task.result.latency.p50,
          p75: task.result.latency.p75,
          p99: task.result.latency.p99,
          rme: task.result.latency.rme,
          sd: task.result.latency.sd,
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
