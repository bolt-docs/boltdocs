import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..')
const BENCHMARKS_DIR = path.join(WORKSPACE_ROOT, '.boltdocs', 'benchmarks')

interface PhaseResult {
  name: string
  duration: number
  success: boolean
  details?: string
  metrics?: Record<string, any>
  subSteps?: PhaseResult[]
}

interface BuildPhasesReport {
  id: string
  timestamp: string
  root: string
  turbo: boolean
  totalDuration: number
  environment: {
    nodeVersion: string
    platform: string
    arch: string
    cpuModel: string
    cpuCores: number
    totalMemory: string
  }
  phases: PhaseResult[]
}

const FIXTURE_SITE_ROOT = path.resolve(__dirname, 'fixture-site')

function parseArgs(): { root: string; turbo: boolean; clean: boolean } {
  const args = process.argv.slice(2)
  let root = FIXTURE_SITE_ROOT
  let turbo = false
  let clean = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--root' && args[i + 1]) {
      root = path.resolve(args[++i])
    } else if (arg.startsWith('--root=')) {
      root = path.resolve(arg.slice('--root='.length))
    } else if (arg === '--turbo') {
      turbo = true
    } else if (arg === '--clean') {
      clean = true
    } else if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
  }

  return { root, turbo, clean }
}

function printHelp(): void {
  console.log(`
Benchmark the Boltdocs build pipeline phase by phase.

By default, this runs against a small fixture site so benchmarks finish
quickly. Pass --root to benchmark a real project.

Usage: tsx scripts/benchmarks/build-phases.ts [options]

Options:
  --root <path>   Project root to build (default: built-in fixture site)
  --turbo         Enable turbo mode (zig-critters WASM parser)
  --clean         Remove .boltdocs and dist before building (cold build)
  -h, --help      Show this help

Examples:
  tsx scripts/benchmarks/build-phases.ts --clean
  tsx scripts/benchmarks/build-phases.ts --root docs --clean
  tsx scripts/benchmarks/build-phases.ts --root docs --turbo --clean
`)
}

function getEnvironmentInfo() {
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
  if (ms < 1000) return `${ms.toFixed(0)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

function cleanProject(root: string): void {
  const dirs = [path.join(root, '.boltdocs'), path.join(root, 'dist')]
  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
}

function stepToPhase(step: {
  name: string
  duration: number
  success: boolean
  details?: string
  metrics?: Record<string, any>
}): PhaseResult {
  return {
    name: step.name,
    duration: step.duration,
    success: step.success,
    details: step.details,
    metrics: step.metrics,
  }
}

const BUILD_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

function runBuild(root: string, turbo: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      BOLTDOCS_BENCHMARK_PHASES: 'true',
      NODE_ENV: 'production',
    }
    if (turbo) {
      env.BOLTDOCS_TURBO = 'true'
    }

    const child = spawn('pnpm', ['exec', 'boltdocs', 'build'], {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM')
      reject(
        new Error(
          `boltdocs build timed out after ${BUILD_TIMEOUT_MS}ms.\nSTDERR:\n${stderr}\nSTDOUT:\n${stdout}`,
        ),
      )
    }, BUILD_TIMEOUT_MS)

    child.on('error', (err) => {
      clearTimeout(timeoutId)
      reject(err)
    })
    child.on('close', (code) => {
      clearTimeout(timeoutId)
      if (code !== 0) {
        reject(
          new Error(
            `boltdocs build failed with code ${code}\nSTDERR:\n${stderr}\nSTDOUT:\n${stdout}`,
          ),
        )
        return
      }
      resolve(stdout)
    })
  })
}

function findLatestReport(root: string): string | null {
  const benchmarksDir = path.join(root, '.boltdocs', 'benchmarks')
  if (!fs.existsSync(benchmarksDir)) return null
  const files = fs
    .readdirSync(benchmarksDir)
    .filter((f) => f.startsWith('phases-report-') && f.endsWith('.json'))
    .sort()
    .reverse()
  return files.length > 0 ? path.join(benchmarksDir, files[0]) : null
}

async function runBenchmark(): Promise<void> {
  const { root, turbo, clean } = parseArgs()

  if (clean) {
    cleanProject(root)
  }

  console.log(`\nRunning phase benchmark...`)
  console.log(`  Root: ${root}`)
  console.log(`  Turbo: ${turbo}`)
  console.log(`  This may take a few minutes.\n`)

  const totalStart = performance.now()
  await runBuild(root, turbo)
  const totalDuration = performance.now() - totalStart

  const reportPath = findLatestReport(root)
  if (!reportPath || !fs.existsSync(reportPath)) {
    throw new Error(
      'Build completed but no phase report was found. Ensure BOLTDOCS_BENCHMARK_PHASES is handled by the CLI.',
    )
  }

  const reportJson = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))
  const stepResults: Array<{
    name: string
    duration: number
    success: boolean
    details?: string
    metrics?: Record<string, any>
  }> = reportJson.stepResults || []

  // Identify SSG internal sub-steps that were flattened into stepResults.
  const ssgInternalNames = new Set([
    'Client build',
    'Server build',
    'Render pages',
    'Static loader data',
    'Build metrics',
  ])
  const ssgSubSteps: PhaseResult[] = []
  const topLevelPhases: PhaseResult[] = []

  for (const step of stepResults) {
    if (ssgInternalNames.has(step.name)) {
      ssgSubSteps.push(stepToPhase(step))
    } else {
      topLevelPhases.push(stepToPhase(step))
    }
  }

  // Merge SSG sub-steps under the SSGBuild phase
  const ssgPhase = topLevelPhases.find((p) => p.name === 'SSGBuild')
  if (ssgPhase) {
    ssgPhase.subSteps = ssgSubSteps
  }

  const runId = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const report: BuildPhasesReport = {
    id: runId,
    timestamp: new Date().toISOString(),
    root,
    turbo,
    totalDuration,
    environment: getEnvironmentInfo(),
    phases: topLevelPhases,
  }

  if (!fs.existsSync(BENCHMARKS_DIR)) {
    fs.mkdirSync(BENCHMARKS_DIR, { recursive: true })
  }
  const jsonPath = path.join(BENCHMARKS_DIR, `phases-${runId}.json`)
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2))

  console.log(`${'='.repeat(70)}`)
  console.log(`  Boltdocs Build Phase Benchmark`)
  console.log(`  Root: ${root}`)
  console.log(`  Turbo: ${turbo}`)
  console.log(`  Wall-clock total: ${formatDuration(totalDuration)}`)
  console.log(`${'='.repeat(70)}\n`)

  console.log(
    `  ${'Phase'.padEnd(26)} │ ${'Duration'.padStart(12)} │ ${'Status'.padStart(8)}`,
  )
  console.log(`  ${'─'.repeat(26)}──${'─'.repeat(12)}─┼─${'─'.repeat(8)}`)

  for (const phase of topLevelPhases) {
    const status = phase.success ? '✅' : ''
    console.log(
      `  ${phase.name.padEnd(26)} │ ${formatDuration(phase.duration).padStart(12)} │ ${status.padStart(8)}`,
    )
    if (phase.subSteps && phase.subSteps.length > 0) {
      for (const sub of phase.subSteps) {
        console.log(
          `    └ ${sub.name.padEnd(24)} │ ${formatDuration(sub.duration).padStart(12)} │ ${sub.success ? 'ok' : 'fail'}`,
        )
      }
    }
  }

  console.log(`\n  JSON report: ${jsonPath}`)
  console.log(`  Raw phase report: ${reportPath}\n`)
}

runBenchmark().catch((err) => {
  console.error('Benchmark failed:', err)
  process.exit(1)
})
