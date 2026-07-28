/**
 * P2-00: Profile Build Harness
 *
 * Runs `boltdocs build` with timing instrumentation and captures
 * phase-level breakdown. Supports cold, warm, and incremental builds
 * with multi-run median reporting.
 *
 * Usage:
 *   tsx scripts/benchmarks/profile-build.ts                    # cold build (3 runs, median)
 *   tsx scripts/benchmarks/profile-build.ts --warm             # warm build (3 runs, median)
 *   tsx scripts/benchmarks/profile-build.ts --runs 1          # single run
 *   tsx scripts/benchmarks/profile-build.ts --touch docs/index.md  # incremental 1-file change
 *   tsx scripts/benchmarks/profile-build.ts --compare         # cold + warm side-by-side
 *
 * Output:
 *   .boltdocs/benchmarks/profile-<timestamp>.json
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..')

interface PhaseTiming {
  name: string
  durationMs: number
  success: boolean
  details?: string
  metrics?: Record<string, number | boolean | string>
}

interface ProfileResult {
  timestamp: string
  docsDir: string
  mode: 'cold' | 'warm' | 'incremental'
  totalDurationMs: number
  phases: PhaseTiming[]
  environment: {
    nodeVersion: string
    platform: string
    arch: string
    cpuModel: string
    cpuCores: number
    totalMemory: string
  }
  bundleMetrics?: {
    buildTime: number
    jsSize: number
    cssSize: number
    totalPages: number
  }
}

interface RunRecord {
  runIndex: number
  result: ProfileResult
}

interface ProfileSummary {
  timestamp: string
  mode: 'cold' | 'warm' | 'incremental'
  runs: number
  medianTotalMs: number
  medianPhases: PhaseTiming[]
  allResults: RunRecord[]
  environment: ProfileResult['environment']
  touchedFile?: string
}

function getCpuModel(): string {
  try {
    const cpus = os.cpus()
    return cpus[0]?.model || 'Unknown'
  } catch {
    return 'Unknown'
  }
}

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`
  if (ms < 1000) return `${ms.toFixed(1)}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

/** Compute median of an array of numbers. */
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

interface CliArgs {
  warm: boolean
  runs: number
  touch: string | null
  compare: boolean
  skipMermaid: boolean
  docsDir: string
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  return {
    warm: args.includes('--warm'),
    runs: (() => {
      const idx = args.indexOf('--runs')
      return idx >= 0 && idx + 1 < args.length
        ? Number.parseInt(args[idx + 1], 10) || 3
        : 3
    })(),
    touch: (() => {
      const idx = args.indexOf('--touch')
      return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : null
    })(),
    compare: args.includes('--compare'),
    skipMermaid: args.includes('--skip-mermaid'),
    docsDir: path.resolve(WORKSPACE_ROOT, 'docs'),
  }
}

/** Touch a file to simulate an incremental change. */
function touchFile(
  filePath: string,
  restoreContent: string | null,
): string | null {
  const absPath = path.resolve(WORKSPACE_ROOT, filePath)
  if (!fs.existsSync(absPath)) {
    console.warn(`  ⚠️  File not found: ${absPath}, touching index.md instead`)
    return touchFile('docs/index.md', restoreContent)
  }
  const originalContent = restoreContent ?? fs.readFileSync(absPath, 'utf-8')
  if (!restoreContent) {
    // Append a unique comment line to guarantee content change.
    // Using replace() on an H1 heading would be a no-op for files without one.
    const marker = `\n\n<!-- incremental-mod-${Date.now()} -->\n`
    const newContent = originalContent + marker
    fs.writeFileSync(absPath, newContent, 'utf-8')
    return originalContent // Return original so caller can restore
  }
  // Restore original content (strip the appended marker)
  const restored = restoreContent
  fs.writeFileSync(absPath, restored, 'utf-8')
  return null
}

async function runBuild(
  docsDir: string,
  options: {
    warm: boolean
    skipMermaid: boolean
    touchedFile: string | null
    runIndex: number
    totalRuns: number
  },
): Promise<ProfileResult> {
  const startTime = performance.now()
  const modeLabel = options.warm
    ? 'WARM'
    : options.touchedFile
      ? 'INCREMENTAL'
      : 'COLD'

  // Clear cache for cold builds only
  if (!options.warm && !options.touchedFile) {
    const cacheDirs = [
      path.join(docsDir, '.boltdocs'),
      path.join(docsDir, 'dist'),
    ]
    for (const dir of cacheDirs) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true })
      }
    }
  }

  const env: Record<string, string> = {
    ...process.env,
    CI: 'true',
    BOLTDOCS_LOG_LEVEL: 'info',
    NODE_ENV: 'production',
  }

  if (options.skipMermaid) {
    env.BOLTDOCS_SKIP_MERMAID = '1'
  }

  const phases: PhaseTiming[] = []

  console.log(`  ${modeLabel} run ${options.runIndex}/${options.totalRuns}...`)

  return new Promise((resolve) => {
    const child = spawn('pnpm', ['exec', 'boltdocs', 'build'], {
      cwd: docsDir,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      stdout += text

      // Parse structured phase timing lines: [boltdocs] { name: '...', duration: ..., success: ... }
      const phaseRegex =
        /\[boltdocs\]\s*\{\s*name:\s*'([^']+)'\s*,\s*duration:\s*([\d.]+)\s*,\s*success:\s*(true|false)/g
      let match: RegExpExecArray | null
      while ((match = phaseRegex.exec(text)) !== null) {
        phases.push({
          name: match[1].trim(),
          durationMs: Number.parseFloat(match[2]),
          success: match[3] === 'true',
        })
      }

      // Also parse the [satteri-mdx] precompile line
      const satteriRegex =
        /\[satteri-mdx\] precompile:\s*(\d+)\s*hit\s*\/\s*(\d+)\s*miss\s*\/\s*(\d+)ms/
      const satteriMatch = text.match(satteriRegex)
      if (satteriMatch) {
        phases.push({
          name: 'MDX precompile (satteri log)',
          durationMs: Number.parseInt(satteriMatch[3], 10),
          success: true,
          details: `${satteriMatch[1]} hit / ${satteriMatch[2]} miss`,
        })
      }
    })

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString()
    })

    child.on('close', (code) => {
      const totalDurationMs = performance.now() - startTime

      // Parse Build metrics line from stdout for bundle info
      const buildMetricsRegex =
        /Build time:\s*([\d.]+)s,\s*JS:\s*([\d.]+)\s*kB,\s*CSS:\s*([\d.]+)\s*kB/
      const metricsMatch = stdout.match(buildMetricsRegex)
      const bundleMetrics = metricsMatch
        ? {
            buildTime: Number.parseFloat(metricsMatch[1]),
            jsSize: Number.parseFloat(metricsMatch[2]),
            cssSize: Number.parseFloat(metricsMatch[3]),
            totalPages: 0,
          }
        : undefined

      // Count HTML files in dist
      const distDir = path.join(docsDir, 'dist')
      let totalPages = 0
      if (fs.existsSync(distDir)) {
        try {
          totalPages = countHtmlFiles(distDir)
        } catch {
          // ignore
        }
      }
      if (bundleMetrics) {
        bundleMetrics.totalPages = totalPages
      }

      const result: ProfileResult = {
        timestamp: new Date().toISOString(),
        docsDir,
        mode: options.touchedFile
          ? 'incremental'
          : options.warm
            ? 'warm'
            : 'cold',
        totalDurationMs,
        phases: phases.filter(
          (p) => p.durationMs > 0 || p.name === 'BUILD FAILED',
        ),
        environment: {
          nodeVersion: process.version,
          platform: `${os.platform()} ${os.release()}`,
          arch: os.arch(),
          cpuModel: getCpuModel(),
          cpuCores: os.cpus().length,
          totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
        },
        bundleMetrics,
      }

      if (code !== 0) {
        result.phases.push({
          name: 'BUILD FAILED',
          durationMs: 0,
          success: false,
          details: stderr.slice(0, 500),
        })
      }

      resolve(result)
    })

    child.on('error', (err) => {
      resolve({
        timestamp: new Date().toISOString(),
        docsDir,
        mode: options.warm ? 'warm' : 'cold',
        totalDurationMs: performance.now() - startTime,
        phases: [
          {
            name: 'SPAWN ERROR',
            durationMs: 0,
            success: false,
            details: err.message,
          },
        ],
        environment: {
          nodeVersion: process.version,
          platform: `${os.platform()} ${os.release()}`,
          arch: os.arch(),
          cpuModel: getCpuModel(),
          cpuCores: os.cpus().length,
          totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
        },
      })
    })
  })
}

function countHtmlFiles(dir: string): number {
  let count = 0
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name !== 'assets' && !entry.name.startsWith('.')) {
          count += countHtmlFiles(path.join(dir, entry.name))
        }
      } else if (entry.name.endsWith('.html')) {
        count++
      }
    }
  } catch {
    // ignore
  }
  return count
}

function computeMedianPhases(allResults: RunRecord[]): PhaseTiming[] {
  if (allResults.length === 0) return []

  // Collect all phase names
  const phaseNames = new Set<string>()
  for (const { result } of allResults) {
    for (const phase of result.phases) {
      phaseNames.add(phase.name)
    }
  }

  const medianPhases: PhaseTiming[] = []
  for (const name of phaseNames) {
    const durations = allResults
      .map((r) => {
        const phase = r.result.phases.find((p) => p.name === name)
        return phase ? phase.durationMs : 0
      })
      .filter((d) => d > 0)

    if (durations.length === 0) continue

    // Pick the result closest to median duration for details
    const med = median(durations)
    const closestIdx =
      durations
        .map((d, i) => ({ diff: Math.abs(d - med), idx: i }))
        .sort((a, b) => a.diff - b.diff)[0]?.idx ?? 0
    const closestResult = allResults[closestIdx]
    const closestPhase = closestResult?.result.phases.find(
      (p) => p.name === name,
    )

    medianPhases.push({
      name,
      durationMs: Math.round(med),
      success: closestPhase?.success ?? true,
      details: closestPhase?.details,
      metrics: closestPhase?.metrics,
    })
  }

  return medianPhases
}

function printSummary(results: RunRecord[], summary: ProfileSummary): void {
  const mode =
    summary.mode === 'cold'
      ? 'COLD'
      : summary.mode === 'warm'
        ? 'WARM'
        : 'INCREMENTAL'
  const allDurations = results.map((r) => r.result.totalDurationMs)
  const med = median(allDurations)
  const min = Math.min(...allDurations)
  const max = Math.max(...allDurations)

  console.log('\n' + '='.repeat(72))
  console.log(`  📊 ${mode} BUILD PROFILE  (${results.length} runs, median)`)

  if (summary.touchedFile) {
    console.log(`  File touched: ${summary.touchedFile}`)
  }

  console.log('='.repeat(72))
  console.log(
    `  Total time: ${formatDuration(med)}  (min: ${formatDuration(min)}, max: ${formatDuration(max)})`,
  )
  console.log(
    `  Pages:      ${summary.allResults[0]?.result.bundleMetrics?.totalPages ?? '?'}`,
  )
  console.log(
    `  JS bundle:  ${summary.allResults[0]?.result.bundleMetrics?.jsSize ?? '?'} kB`,
  )
  console.log(
    `  CSS bundle: ${summary.allResults[0]?.result.bundleMetrics?.cssSize ?? '?'} kB`,
  )
  console.log(
    `  CPU:        ${summary.environment.cpuModel} (${summary.environment.cpuCores} cores)`,
  )
  console.log(`  RAM:        ${summary.environment.totalMemory}`)
  console.log('')

  const sortedPhases = [...summary.medianPhases].sort(
    (a, b) => b.durationMs - a.durationMs,
  )

  if (sortedPhases.length === 0) {
    console.log('  ⚠️  No phase timing data captured.')
    console.log('')
    return
  }

  console.log(
    `  ${'Phase'.padEnd(32)} │ ${'Duration'.padStart(12)} │ ${'% of total'.padStart(10)} │ Status`,
  )
  console.log(
    `  ${'─'.repeat(32)}─┼─${'─'.repeat(12)}─┼─${'─'.repeat(10)}─┼─${'─'.repeat(8)}`,
  )

  for (const phase of sortedPhases) {
    const percent =
      med > 0 ? ((phase.durationMs / med) * 100).toFixed(1) : '0.0'
    const status = phase.success ? '✅' : '❌'
    const name =
      phase.name.length > 30 ? phase.name.slice(0, 27) + '...' : phase.name

    console.log(
      `  ${name.padEnd(32)} │ ${formatDuration(phase.durationMs).padStart(12)} │ ${percent.padStart(9)}% │ ${status}`,
    )
  }

  console.log('')

  // Print details for phases with details
  const phasesWithDetails = summary.medianPhases.filter((p) => p.details)
  if (phasesWithDetails.length > 0) {
    console.log('  📋 Phase Details:')
    for (const phase of phasesWithDetails) {
      console.log(`    • ${phase.name}: ${phase.details}`)
    }
    console.log('')
  }

  // Print per-run details
  console.log(`  📋 Per-run totals:`)
  for (const { runIndex, result } of results) {
    const duration = result.totalDurationMs
    const pages = result.bundleMetrics?.totalPages ?? '?'
    const bar = getProgressBar(duration, min, max)
    console.log(
      `    ${runIndex}. ${bar} ${formatDuration(duration).padStart(10)}  (${pages} pages)`,
    )
  }
  console.log('')
  console.log('='.repeat(72))
  console.log('')
}

function getProgressBar(
  value: number,
  min: number,
  max: number,
  width = 20,
): string {
  if (max === min) return '█'.repeat(width)
  const ratio = (value - min) / (max - min)
  const filled = Math.round(ratio * width)
  return '█'.repeat(width - filled) + '░'.repeat(filled)
}

function printComparison(
  coldSummary: ProfileSummary | null,
  warmSummary: ProfileSummary | null,
): void {
  if (!coldSummary && !warmSummary) return

  console.log('\n' + '='.repeat(72))
  console.log('  🔄 COLD vs WARM COMPARISON')
  console.log('='.repeat(72))

  const coldMed = coldSummary?.medianTotalMs ?? 0
  const warmMed = warmSummary?.medianTotalMs ?? 0
  const delta =
    coldMed > 0 ? Math.round(((coldMed - warmMed) / coldMed) * 100) : 0

  console.log(
    `  ${'Cold build:'.padEnd(20)} ${formatDuration(coldMed).padStart(12)}`,
  )
  console.log(
    `  ${'Warm build:'.padEnd(20)} ${formatDuration(warmMed).padStart(12)}`,
  )
  console.log(
    `  ${'Δ:'.padEnd(20)} ${formatDuration(coldMed - warmMed).padStart(12)}  (-${delta}%)`,
  )
  console.log('')

  // Compare phases
  const coldPhases = coldSummary?.medianPhases ?? []
  const warmPhases = warmSummary?.medianPhases ?? []
  const allPhaseNames = new Set([
    ...coldPhases.map((p) => p.name),
    ...warmPhases.map((p) => p.name),
  ])

  console.log(
    `  ${'Phase'.padEnd(32)} │ ${'Cold'.padStart(12)} │ ${'Warm'.padStart(12)} │ ${'Δ'.padStart(10)}`,
  )
  console.log(
    `  ${'─'.repeat(32)}─┼─${'─'.repeat(12)}─┼─${'─'.repeat(12)}─┼─${'─'.repeat(10)}`,
  )

  for (const name of allPhaseNames) {
    const coldPhase = coldPhases.find((p) => p.name === name)
    const warmPhase = warmPhases.find((p) => p.name === name)
    const coldDur = coldPhase?.durationMs ?? 0
    const warmDur = warmPhase?.durationMs ?? 0
    const phaseDelta = coldDur - warmDur
    const deltaStr =
      phaseDelta >= 0
        ? `-${formatDuration(phaseDelta)}`
        : `+${formatDuration(Math.abs(phaseDelta))}`

    const displayName = name.length > 30 ? name.slice(0, 27) + '...' : name
    console.log(
      `  ${displayName.padEnd(32)} │ ${formatDuration(coldDur).padStart(12)} │ ${formatDuration(warmDur).padStart(12)} │ ${deltaStr.padStart(10)}`,
    )
  }
  console.log('')
  console.log('='.repeat(72))
  console.log('')
}

function saveSummary(summary: ProfileSummary): string {
  const benchmarksDir = path.join(WORKSPACE_ROOT, '.boltdocs', 'benchmarks')
  if (!fs.existsSync(benchmarksDir)) {
    fs.mkdirSync(benchmarksDir, { recursive: true })
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const mode = summary.mode
  const filename = `profile-${mode}-${timestamp}.json`
  const filePath = path.join(benchmarksDir, filename)
  fs.writeFileSync(filePath, JSON.stringify(summary, null, 2))
  return filePath
}

async function main(): Promise<void> {
  const options = parseArgs()

  console.log('\n' + '═'.repeat(72))
  console.log('  🔍 P2-00: Profile Build Harness')
  console.log('═'.repeat(72))
  console.log(`  Docs:  ${options.docsDir}`)
  console.log(`  Runs:  ${options.runs} (median reported)`)

  if (options.compare) {
    console.log(`  Mode:  COLD vs WARM comparison`)
  } else if (options.touch) {
    console.log(`  Mode:  INCREMENTAL (touch: ${options.touch})`)
  } else if (options.warm) {
    console.log(`  Mode:  WARM (reuse cache)`)
  } else {
    console.log(`  Mode:  COLD (clear cache)`)
  }

  console.log('')

  let coldSummary: ProfileSummary | null = null
  let warmSummary: ProfileSummary | null = null
  let touchedFilePath: string | null = null

  if (options.compare) {
    // Run cold first
    const coldRuns: RunRecord[] = []
    for (let i = 1; i <= options.runs; i++) {
      const result = await runBuild(options.docsDir, {
        warm: false,
        skipMermaid: options.skipMermaid,
        touchedFile: null,
        runIndex: i,
        totalRuns: options.runs,
      })
      coldRuns.push({ runIndex: i, result })
    }
    const coldMed = median(coldRuns.map((r) => r.result.totalDurationMs))
    const coldEnv = coldRuns[0]?.result.environment
    if (!coldEnv) throw new Error('No cold build results')
    coldSummary = {
      timestamp: new Date().toISOString(),
      mode: 'cold',
      runs: options.runs,
      medianTotalMs: Math.round(coldMed),
      medianPhases: computeMedianPhases(coldRuns),
      allResults: coldRuns,
      environment: coldEnv,
    }

    // Save cold summary
    const coldPath = saveSummary(coldSummary)
    console.log(`  Cold summary saved to: ${coldPath}\n`)

    // Then warm
    const warmRuns: RunRecord[] = []
    for (let i = 1; i <= options.runs; i++) {
      const result = await runBuild(options.docsDir, {
        warm: true,
        skipMermaid: options.skipMermaid,
        touchedFile: null,
        runIndex: i,
        totalRuns: options.runs,
      })
      warmRuns.push({ runIndex: i, result })
    }
    const warmMed = median(warmRuns.map((r) => r.result.totalDurationMs))
    const warmEnv = warmRuns[0]?.result.environment
    if (!warmEnv) throw new Error('No warm build results')
    warmSummary = {
      timestamp: new Date().toISOString(),
      mode: 'warm',
      runs: options.runs,
      medianTotalMs: Math.round(warmMed),
      medianPhases: computeMedianPhases(warmRuns),
      allResults: warmRuns,
      environment: warmEnv,
    }

    // Save warm summary
    const warmPath = saveSummary(warmSummary)
    console.log(`  Warm summary saved to: ${warmPath}\n`)
  } else {
    const mode = options.warm ? 'warm' : options.touch ? 'incremental' : 'cold'
    let fileContentBackup: string | null = null

    if (options.touch) {
      fileContentBackup = touchFile(options.touch, null)
      touchedFilePath = options.touch
    }

    const runs: RunRecord[] = []
    for (let i = 1; i <= options.runs; i++) {
      const result = await runBuild(options.docsDir, {
        warm: options.warm,
        skipMermaid: options.skipMermaid,
        touchedFile: options.touch,
        runIndex: i,
        totalRuns: options.runs,
      })
      runs.push({ runIndex: i, result })
    }

    // If incremental, restore the file
    if (options.touch && fileContentBackup) {
      touchFile(options.touch, fileContentBackup)
      console.log(`  ✅ Restored ${options.touch} to original content\n`)
    }

    const med = median(runs.map((r) => r.result.totalDurationMs))
    const summary: ProfileSummary = {
      timestamp: new Date().toISOString(),
      mode,
      runs: options.runs,
      medianTotalMs: Math.round(med),
      medianPhases: computeMedianPhases(runs),
      allResults: runs,
      environment: runs[0]?.result.environment ?? runs[0]!.result.environment,
      touchedFile: touchedFilePath ?? undefined,
    }

    printSummary(runs, summary)

    // Save
    const savedPath = saveSummary(summary)
    console.log(`  💾 Saved to: ${savedPath}\n`)
  }

  // If compare mode, print cold vs warm table
  if (options.compare) {
    printComparison(coldSummary, warmSummary)
  }
}

main().catch((err) => {
  console.error('Profile failed:', err)
  process.exit(1)
})
