import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { runBuildPipelineSuite } from './build-pipeline'
import { runSSGRenderingSuite } from './ssg-rendering'
import { runViteBuildSuite } from './vite-builds'
import { runParserSuite } from './parser-speed'
import { runMdxTransformSuite } from './mdx-transforms'
import { generateHtmlReport } from './utils/report-generator'
import type {
  BenchmarkConfig,
  BenchmarkRunResult,
  SuiteResult,
  EnvironmentInfo,
} from './utils/types'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..')
const BENCHMARKS_DIR = path.join(WORKSPACE_ROOT, '.boltdocs', 'benchmarks')

type SuiteRunner = (config: BenchmarkConfig) => Promise<SuiteResult>

const ALL_SUITES: Record<string, { name: string; run: SuiteRunner }> = {
  pipeline: { name: 'Build Pipeline', run: runBuildPipelineSuite },
  ssg: { name: 'SSG Rendering', run: runSSGRenderingSuite },
  vite: { name: 'Vite Build', run: runViteBuildSuite },
  parser: { name: 'Parser', run: runParserSuite },
  mdx: { name: 'MDX Transforms', run: runMdxTransformSuite },
}

const DEFAULT_CONFIG: BenchmarkConfig = {
  time: 1000,
  iterations: 100,
  warmupIterations: 10,
  warmupTime: 100,
}

function parseArgs(): BenchmarkConfig & {
  suiteNames: string[]
  help: boolean
} {
  const args = process.argv.slice(2)
  const config: BenchmarkConfig & { suiteNames: string[]; help: boolean } = {
    ...DEFAULT_CONFIG,
    suiteNames: ['all'],
    help: false,
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--help':
      case '-h':
        config.help = true
        break
      case '--time':
      case '-t':
        config.time = Number(args[++i]) || DEFAULT_CONFIG.time
        break
      case '--iterations':
      case '-i':
        config.iterations = Number(args[++i]) || DEFAULT_CONFIG.iterations
        break
      case '--warmup':
      case '-w':
        config.warmupIterations =
          Number(args[++i]) || DEFAULT_CONFIG.warmupIterations
        break
      case '--suite':
      case '-s':
        config.suiteNames = [args[++i] || 'all']
        break
      case '--output':
      case '-o':
        config.outputFile = args[++i]
        break
    }
  }

  return config
}

function printHelp(): void {
  console.log(`
Boltdocs Benchmark Suite
========================

Usage: tsx scripts/benchmark-suite.ts [options]

Options:
  -s, --suite <name>     Run specific suite: all, pipeline, ssg, vite, parser, mdx (default: all)
  -t, --time <ms>        Time per task in ms (default: 1000)
  -i, --iterations <n>   Minimum iterations per task (default: 100)
  -w, --warmup <n>       Warmup iterations (default: 10)
  -o, --output <dir>     Output directory for reports (default: .boltdocs/benchmarks)
  -h, --help             Show this help

Examples:
  tsx scripts/benchmark-suite.ts
  tsx scripts/benchmark-suite.ts --suite pipeline
  tsx scripts/benchmark-suite.ts --suite vite --time 2000
  tsx scripts/benchmark-suite.ts --suite parser --iterations 200
`)
}

function getEnvironmentInfo(): EnvironmentInfo {
  const cpus = os.cpus()
  return {
    nodeVersion: process.version,
    platform: `${os.platform()} ${os.release()}`,
    arch: os.arch(),
    cpuModel: cpus[0]?.model || 'Unknown',
    cpuCores: cpus.length,
    totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
  }
}

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`
  if (ms < 1000) return `${ms.toFixed(2)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function printSuiteHeader(name: string, description: string): void {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${name}`)
  console.log(`  ${description}`)
  console.log(`${'='.repeat(60)}`)
}

function printTaskResult(task: {
  task: string
  latency: { mean: number; rme: number }
  throughput: { mean: number }
}): void {
  console.log(
    `  ${task.task.padEnd(45)} │ ${formatDuration(task.latency.mean).padStart(10)} ± ${task.latency.rme.toFixed(1).padStart(5)}% │ ${String(Math.round(task.throughput.mean)).padStart(8)} ops/s`,
  )
}

async function runSuite(
  suiteKey: string,
  config: BenchmarkConfig,
): Promise<SuiteResult | null> {
  const suite = ALL_SUITES[suiteKey]
  if (!suite) {
    console.error(`Unknown suite: ${suiteKey}`)
    return null
  }

  printSuiteHeader(suite.name, getSuiteDescription(suiteKey))

  console.log(
    `\n  Running with: ${config.time}ms/task, ${config.iterations} min iterations, ${config.warmupIterations} warmup\n`,
  )
  console.log(
    `  ${'Task'.padEnd(45)} │ ${'Latency'.padStart(10)} │ ${'RME'.padStart(7)} │ ${'Throughput'.padStart(10)}`,
  )
  console.log(
    `  ${'─'.repeat(45)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(7)}─┼─${'─'.repeat(10)}`,
  )

  try {
    const result = await suite.run(config)

    console.log(
      `\n  ${'─'.repeat(45)}─┴─${'─'.repeat(10)}─┴─${'─'.repeat(7)}─┴─${'─'.repeat(10)}`,
    )

    for (const task of result.tasks) {
      printTaskResult(task)
    }

    console.log(`\n  Suite completed in ${formatDuration(result.duration)}`)
    return result
  } catch (err) {
    console.error(`  ERROR running suite "${suite.name}":`, err)
    return null
  }
}

function getSuiteDescription(key: string): string {
  const descriptions: Record<string, string> = {
    pipeline:
      'Benchmarks individual pipeline steps: route generation, SEO validation, type generation',
    ssg: 'Benchmarks page rendering: JSDOM parsing, script injection, HTML manipulation',
    vite: 'Benchmarks Vite build phases: file hashing, manifest parsing, config resolution',
    parser:
      'Benchmarks markdown parsing: frontmatter extraction, heading extraction, content parsing',
    mdx: 'Benchmarks MDX compilation: frontmatter parsing, remark/rehype chains, syntax highlighting',
  }
  return descriptions[key] || ''
}

async function main(): Promise<void> {
  const config = parseArgs()

  if (config.help) {
    printHelp()
    return
  }

  const suiteKeys = config.suiteNames.includes('all')
    ? Object.keys(ALL_SUITES)
    : config.suiteNames.filter((s) => s in ALL_SUITES)

  if (suiteKeys.length === 0) {
    console.error(
      `No matching suites found for: ${config.suiteNames.join(', ')}`,
    )
    console.error(
      `Available suites: ${Object.keys(ALL_SUITES).join(', ')}, all`,
    )
    process.exit(1)
  }

  const suiteNames = suiteKeys.map((k) => ALL_SUITES[k].name).join(', ')
  console.log(`
╔══════════════════════════════════════════════════════════╗
║           Boltdocs Benchmark Suite                       ║
╠══════════════════════════════════════════════════════════╣
║  Suites: ${suiteNames.padEnd(47)}║
║  Config: ${config.time}ms/task, ${config.iterations} min iterations${' '.repeat(Math.max(0, 32 - String(config.time).length - String(config.iterations).length))}║
╚══════════════════════════════════════════════════════════╝
`)

  const environment = getEnvironmentInfo()
  const suiteResults: SuiteResult[] = []
  const totalStart = performance.now()

  for (const key of suiteKeys) {
    const result = await runSuite(key, config)
    if (result) {
      suiteResults.push(result)
    }
  }

  const totalDuration = performance.now() - totalStart

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  SUMMARY`)
  console.log(`${'='.repeat(60)}`)
  console.log(`  Total suites: ${suiteResults.length}`)
  console.log(
    `  Total tasks: ${suiteResults.reduce((a, s) => a + s.tasks.length, 0)}`,
  )
  console.log(`  Total time: ${formatDuration(totalDuration)}`)

  const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const runResult: BenchmarkRunResult = {
    id: runId,
    timestamp: new Date().toISOString(),
    suites: suiteResults,
    environment,
  }

  if (!fs.existsSync(BENCHMARKS_DIR)) {
    fs.mkdirSync(BENCHMARKS_DIR, { recursive: true })
  }

  const jsonPath = path.join(BENCHMARKS_DIR, `${runId}.json`)
  fs.writeFileSync(jsonPath, JSON.stringify(runResult, null, 2))
  console.log(`\n  JSON results: ${jsonPath}`)

  const htmlDir = config.outputFile || BENCHMARKS_DIR
  const htmlPath = generateHtmlReport(runResult, htmlDir)
  console.log(`  HTML report:  ${htmlPath}`)

  console.log(
    `\n  Done! Open the HTML report to see visual charts and comparisons.\n`,
  )
}

main().catch((err) => {
  console.error('Benchmark failed:', err)
  process.exit(1)
})
