#!/usr/bin/env tsx
/**
 * Profile the docs build and capture phase-level timings.
 *
 * Measures THREE scenarios:
 *   1. Cold build (clean cache + dist)
 *   2. Warm build (no changes, repeat build)
 *   3. Incremental build (one file changed)
 *
 * Usage:
 *   tsx scripts/benchmarks/profile-docs-build.ts [--page-count <N>] [--turbo]
 *
 * Generates a structured JSON report to .boltdocs/benchmarks/.
 */

import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import os from 'node:os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..')
const DOCS_DIR = path.join(WORKSPACE_ROOT, 'docs')

interface PhaseTiming {
  name: string
  durationMs: number
  success: boolean
  details?: string
  metrics?: Record<string, unknown>
}

interface BuildScenario {
  label: string
  totalDurationMs: number
  phases: PhaseTiming[]
  success: boolean
  cached: boolean
  basePages: number
  generatedPages: number
  totalPages: number
  pipelineMetrics?: Record<string, unknown>
  outputSizeBytes: number
  outputFileCount: number
  ssrBundleSizeBytes: number
  workerCount: number
  requestedWorkers: number | null
}

interface BuildProfile {
  timestamp: string
  // `pageCount` remains the CLI-generated count for backwards compatibility.
  // These fields make the benchmark denominator explicit.
  pageCount: number
  basePages: number
  generatedPages: number
  totalPages: number
  turbo: boolean
  scenarios: {
    cold: BuildScenario
    warm: BuildScenario
    incremental: BuildScenario
  }
  output: {
    cold: { sizeBytes: number; fileCount: number; ssrBundleSizeBytes: number }
    warm: { sizeBytes: number; fileCount: number; ssrBundleSizeBytes: number }
    incremental: {
      sizeBytes: number
      fileCount: number
      ssrBundleSizeBytes: number
    }
  }
  breakdown: {
    clientBuildMs: number
    serverBuildMs: number
    renderPagesMs: number
    totalBuildMs: number
  }
  systemInfo: {
    nodeVersion: string
    cpuModel: string
    cpuCores: number
    totalMemory: string
  }
}

function parseArgs(): { pageCount: number; turbo: boolean } {
  const args = process.argv.slice(2)
  let pageCount = 0
  let turbo = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--page-count') {
      pageCount = Number(args[++i]) || 0
    } else if (args[i] === '--turbo') {
      turbo = true
    }
  }

  return { pageCount, turbo }
}

function getSystemInfo() {
  const cpus = os.cpus()
  return {
    nodeVersion: process.version,
    cpuModel: cpus[0]?.model || 'Unknown',
    cpuCores: cpus.length,
    totalMemory: `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`,
  }
}

function generatePages(count: number): void {
  const docsDir = path.join(DOCS_DIR, 'docs')
  const benchDir = path.join(docsDir, 'bench-gen')

  if (fs.existsSync(benchDir)) {
    fs.rmSync(benchDir, { recursive: true, force: true })
  }

  if (count === 0) return

  fs.mkdirSync(benchDir, { recursive: true })

  const metaContent = { benchGen: 'Benchmark Pages' }
  fs.writeFileSync(
    path.join(benchDir, '_meta.json'),
    JSON.stringify(metaContent, null, 2),
  )

  for (let i = 1; i <= count; i++) {
    const content = `---
title: Benchmark Page ${i}
sidebar_position: ${i + 1000}
description: Generated benchmark page ${i} for performance testing
---

# Benchmark Page ${i}

This page is part of the benchmark suite.

## Section A

Lorem ipsum dolor sit amet, consectetur adipiscing elit.

- **Bold item** with description
- *Italic item* with notes
- \`inline code\` example
- [External link](https://example.com)

## Section B

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Value ${i}.1 | Value ${i}.2 | Value ${i}.3 |
| Value ${i}.4 | Value ${i}.5 | Value ${i}.6 |

<div class="callout callout-info">
  <strong>Note:</strong> This is a generated page for benchmarking.
</div>

\`\`\`typescript
interface BenchmarkEntry {
  id: number
  title: string
  generated: boolean
}

const entry: BenchmarkEntry = {
  id: ${i},
  title: 'Benchmark Page ${i}',
  generated: true,
}
\`\`\`

## Section C

> Blockquote for page ${i}.

More content to simulate real-world page complexity.

1. First item
2. Second item
3. Third item

## Section D

Final section with concluding remarks about benchmark page ${i}.

- Nested item A
  - Sub-item A1
  - Sub-item A2
- Nested item B
  - Sub-item B1
`
    fs.writeFileSync(path.join(benchDir, `page-${i}.md`), content)
  }

  console.log(`  Generated ${count} benchmark pages`)
}

function cleanupGeneratedPages(): void {
  const benchDir = path.join(DOCS_DIR, 'docs', 'bench-gen')
  if (fs.existsSync(benchDir)) {
    fs.rmSync(benchDir, { recursive: true, force: true })
    console.log('  Cleaned up generated benchmark pages')
  }
}

interface ArtifactBackup {
  directory: string
  backupPath: string
}

function preserveBuildArtifacts(): () => void {
  // Keep the backup on the same filesystem as the docs artifacts so
  // renameSync remains atomic even when /tmp is mounted separately.
  const backupRoot = fs.mkdtempSync(path.join(DOCS_DIR, '.boltdocs-profile-'))
  const backups: ArtifactBackup[] = []

  const restore = () => {
    for (const { directory, backupPath } of [...backups].reverse()) {
      if (fs.existsSync(directory)) {
        fs.rmSync(directory, { recursive: true, force: true })
      }
      if (fs.existsSync(backupPath)) {
        fs.renameSync(backupPath, directory)
      }
    }
  }

  try {
    for (const directory of [
      path.join(DOCS_DIR, '.boltdocs'),
      path.join(DOCS_DIR, 'dist'),
      path.join(DOCS_DIR, 'docs', 'bench-gen'),
    ]) {
      if (!fs.existsSync(directory)) continue
      const backupPath = path.join(backupRoot, path.basename(directory))
      fs.renameSync(directory, backupPath)
      backups.push({ directory, backupPath })
    }
  } catch (error) {
    try {
      restore()
      fs.rmSync(backupRoot, { recursive: true, force: true })
    } catch {
      // Keep backupRoot intact if rollback itself fails so the original
      // artifacts remain recoverable instead of being deleted.
    }
    throw error
  }

  return () => {
    restore()
    // Only remove the temporary backup after every directory has been
    // restored successfully. If restoration throws, the backup remains
    // available for manual recovery instead of being deleted in finally.
    fs.rmSync(backupRoot, { recursive: true, force: true })
  }
}

function findMarkdownFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const files: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const filePath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...findMarkdownFiles(filePath))
    } else if (entry.isFile() && /\.(md|mdx)$/.test(entry.name)) {
      files.push(filePath)
    }
  }
  return files
}

async function waitForProcessGroupExit(
  pid: number,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      process.kill(-pid, 0)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return false
}

function runBuild(
  turbo: boolean,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    // Invoke the docs package directly. The root `pnpm build --filter docs`
    // command delegates to Turborepo and can replay a task cache hit without
    // executing Boltdocs, which invalidates warm/incremental measurements.
    const args = ['--filter', 'docs', 'build']

    const child = spawn('pnpm', args, {
      cwd: WORKSPACE_ROOT,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        BOLTDOCS_TURBO: turbo ? 'true' : 'false',
        BOLTDOCS_BENCHMARK_PHASES: 'true',
        NODE_ENV: 'production',
      },
    })

    const terminateBuild = () => {
      if (!child.pid) return
      try {
        process.kill(-child.pid, 'SIGTERM')
      } catch {
        child.kill('SIGTERM')
      }
    }

    let stdout = ''
    let stderr = ''
    let timedOut = false
    let forceKillTimer: NodeJS.Timeout | undefined
    const timeoutMs =
      Number(process.env.BOLTDOCS_PROFILE_TIMEOUT_MS) || 15 * 60 * 1000
    const timeout = setTimeout(() => {
      timedOut = true
      terminateBuild()
      forceKillTimer = setTimeout(() => {
        if (!child.pid) return
        try {
          process.kill(-child.pid, 'SIGKILL')
        } catch {
          child.kill('SIGKILL')
        }
      }, 5000)
    }, timeoutMs)

    child.stdout.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })

    child.stderr.setEncoding('utf8')
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })

    child.on('error', (err) => {
      clearTimeout(timeout)
      if (forceKillTimer) clearTimeout(forceKillTimer)
      reject(err)
    })

    child.on('close', async (exitCode) => {
      clearTimeout(timeout)
      if (forceKillTimer) clearTimeout(forceKillTimer)
      let groupExited = true
      if (child.pid) {
        groupExited = await waitForProcessGroupExit(
          child.pid,
          timedOut ? 10000 : 2000,
        )
        if (!groupExited) {
          try {
            process.kill(-child.pid, 'SIGKILL')
          } catch {
            child.kill('SIGKILL')
          }
          groupExited = await waitForProcessGroupExit(child.pid, 2000)
        }
      }
      if (!groupExited) {
        reject(new Error('Build process group did not exit cleanly'))
        return
      }
      if (timedOut) {
        reject(
          new Error(
            `Build timed out after ${Math.round(timeoutMs / 60000)} minutes`,
          ),
        )
        return
      }
      resolve({ stdout, stderr, exitCode: exitCode ?? 1 })
    })
  })
}

function extractPhaseTimings(stdout: string): PhaseTiming[] {
  const phases: PhaseTiming[] = []

  // Parse @bdocs/dui table output format. The buildAction in cli/build.ts
  // renders a step list like:
  //   ✓ ConfigResolve .... 1.2s
  //   ✓ RouteGenerate .... 0.3s
  // Then a table like:
  //   Build Time │ 26.4s
  //   Pages      │ 100
  // And a total line:
  //   Total              26.4s

  for (const line of stdout.split('\n')) {
    // Match step lines: "  ✓ ConfigResolve ........ 1.2s"
    // or: "  ✓ Client build ........ 12.3s"
    const stepMatch = line.match(/[✓✔]\s+(.+?)\s+[.\s]+\s*(\d+\.?\d*)\s*(ms|s)/)
    if (stepMatch) {
      const name = stepMatch[1].trim()
      const val = parseFloat(stepMatch[2])
      const unit = stepMatch[3]
      phases.push({
        name,
        durationMs: unit === 's' ? val * 1000 : val,
        success: true,
      })
      continue
    }

    // Match onStep output: name with duration
    // e.g.: Client build │ 12.3s
    // e.g.: Server build │ 8.1s
    // e.g.: Render pages │ 4.2s
    const onStepMatch = line.match(
      /(Client build|Server build|Render pages|Static loader data)\s*│\s*(\d+\.?\d*)\s*(ms|s)/,
    )
    if (onStepMatch) {
      const name = onStepMatch[1].trim()
      const val = parseFloat(onStepMatch[2])
      const unit = onStepMatch[3]
      const existing = phases.find((p) => p.name === name)
      if (existing) {
        existing.durationMs = unit === 's' ? val * 1000 : val
      } else {
        phases.push({
          name,
          durationMs: unit === 's' ? val * 1000 : val,
          success: true,
        })
      }
      continue
    }

    // Match "Build Time │ 26.4s" or "Build Time | 12.3s"
    const btMatch = line.match(/Build\s*Time\s*[│|]\s*(\d+\.?\d*)\s*(ms|s)/)
    if (btMatch) {
      const val = parseFloat(btMatch[1])
      const unit = btMatch[2]
      phases.push({
        name: 'Build Time',
        durationMs: unit === 's' ? val * 1000 : val,
        success: true,
      })
      continue
    }

    // Match "/  Total  xx.xs" or "Total    xx.xs"
    const totalMatch = line.match(/Total\s{2,}(\d+\.?\d*)\s*(ms|s)/)
    if (totalMatch) {
      const val = parseFloat(totalMatch[1])
      const unit = totalMatch[2]
      phases.push({
        name: 'Pipeline Total',
        durationMs: unit === 's' ? val * 1000 : val,
        success: true,
      })
    }
  }

  return phases
}

function getDirectoryStats(directory: string): {
  sizeBytes: number
  fileCount: number
} {
  let sizeBytes = 0
  let fileCount = 0
  if (!fs.existsSync(directory)) return { sizeBytes, fileCount }

  const visit = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const filePath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        visit(filePath)
      } else if (entry.isFile()) {
        fileCount++
        try {
          sizeBytes += fs.statSync(filePath).size
        } catch {
          // Ignore files removed while the build is finishing.
        }
      }
    }
  }

  visit(directory)
  return { sizeBytes, fileCount }
}

function getMetricNumber(phase: PhaseTiming | undefined, key: string): number {
  const value = phase?.metrics?.[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function getRequestedWorkers(): number | null {
  const value = Number.parseInt(process.env.BOLTDOCS_SSG_WORKERS || '', 10)
  return Number.isFinite(value) && value > 0 ? value : null
}

function clearPhaseReports(): void {
  const benchmarksDir = path.join(DOCS_DIR, '.boltdocs', 'benchmarks')
  if (!fs.existsSync(benchmarksDir)) return
  for (const file of fs.readdirSync(benchmarksDir)) {
    if (file.startsWith('phases-report-') && file.endsWith('.json')) {
      fs.rmSync(path.join(benchmarksDir, file), { force: true })
    }
  }
}

function getLatestDirectoryStats(directory: string): {
  sizeBytes: number
  fileCount: number
} {
  if (!fs.existsSync(directory)) return { sizeBytes: 0, fileCount: 0 }
  const directories = fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const directoryPath = path.join(directory, entry.name)
      return { directoryPath, mtimeMs: fs.statSync(directoryPath).mtimeMs }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
  const latest = directories[0]
  return latest
    ? getDirectoryStats(latest.directoryPath)
    : { sizeBytes: 0, fileCount: 0 }
}

function findLatestPhaseReport(): {
  phases: PhaseTiming[]
} | null {
  const benchmarksDir = path.join(DOCS_DIR, '.boltdocs', 'benchmarks')
  if (!fs.existsSync(benchmarksDir)) return null
  const files = fs
    .readdirSync(benchmarksDir)
    .filter(
      (file) => file.startsWith('phases-report-') && file.endsWith('.json'),
    )
    .sort()
    .reverse()
  if (files.length === 0) return null

  try {
    const report = JSON.parse(
      fs.readFileSync(path.join(benchmarksDir, files[0]), 'utf8'),
    ) as {
      stepResults?: Array<PhaseTiming & { duration?: number }>
    }
    return {
      phases: (report.stepResults ?? []).map((phase) => ({
        ...phase,
        durationMs: phase.durationMs ?? phase.duration ?? 0,
      })),
    }
  } catch {
    return null
  }
}

async function measureScenario(
  label: string,
  turbo: boolean,
  cleanCache: boolean,
  basePages: number,
  generatedPages: number,
): Promise<BuildScenario> {
  console.log(`\n  📐 ${label}`)

  if (cleanCache) {
    const cacheDir = path.join(DOCS_DIR, '.boltdocs')
    const distDir = path.join(DOCS_DIR, 'dist')
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true })
    }
    if (fs.existsSync(distDir)) {
      fs.rmSync(distDir, { recursive: true, force: true })
    }
    console.log('    Cache + dist cleaned')
  }

  clearPhaseReports()
  const start = performance.now()
  let stdout = ''
  let stderr = ''
  let exitCode = 1
  try {
    const result = await runBuild(turbo)
    stdout = result.stdout
    stderr = result.stderr
    exitCode = result.exitCode
  } catch (error) {
    stderr =
      error instanceof Error ? error.stack || error.message : String(error)
  }
  const totalMs = performance.now() - start
  const cached = /cache hit/i.test(stdout)

  if (exitCode !== 0) {
    console.error(`    ❌ Build failed (exit ${exitCode})`)
    const errorOutput = stderr.trim()
    if (errorOutput) {
      console.error(`    stderr:\n${errorOutput.slice(-4000)}`)
    }
    return {
      label,
      totalDurationMs: totalMs,
      phases: [],
      success: false,
      cached,
      basePages,
      generatedPages,
      totalPages: basePages + generatedPages,
      outputSizeBytes: 0,
      outputFileCount: 0,
      ssrBundleSizeBytes: 0,
      workerCount: 0,
      requestedWorkers: getRequestedWorkers(),
    }
  }

  const phaseReport = findLatestPhaseReport()
  const phases = phaseReport?.phases ?? extractPhaseTimings(stdout)
  const output = getDirectoryStats(path.join(DOCS_DIR, 'dist'))
  const ssr = getLatestDirectoryStats(
    path.join(DOCS_DIR, '.boltdocs', 'build', 'ssr'),
  )
  const renderPhase = phases.find((phase) => phase.name === 'Render pages')
  const workerCount = getMetricNumber(renderPhase, 'workerCount')
  const requestedWorkers = getRequestedWorkers()
  const pipelineMetrics =
    renderPhase?.metrics?.pipeline &&
    typeof renderPhase.metrics.pipeline === 'object'
      ? (renderPhase.metrics.pipeline as Record<string, unknown>)
      : undefined
  console.log(
    `    ✅ ${(totalMs / 1000).toFixed(1)}s total (${basePages} base + ${generatedPages} generated = ${basePages + generatedPages} pages, ${phases.length} phases parsed, ${(output.sizeBytes / 1024 / 1024).toFixed(1)} MB dist, ${workerCount || 'main'} workers)`,
  )

  return {
    label,
    totalDurationMs: totalMs,
    phases,
    success: true,
    cached,
    basePages,
    generatedPages,
    totalPages: basePages + generatedPages,
    pipelineMetrics,
    outputSizeBytes: output.sizeBytes,
    outputFileCount: output.fileCount,
    ssrBundleSizeBytes: ssr.sizeBytes,
    workerCount,
    requestedWorkers,
  }
}

async function main() {
  const { pageCount, turbo } = parseArgs()

  console.log(`
╔══════════════════════════════════════════════════════════╗
║          Boltdocs Build Profiler                          ║
╠══════════════════════════════════════════════════════════╣
║  Mode:      ${(turbo ? 'Turbo (zig-critters)' : 'Normal').padEnd(47)}║
║  Pages:     ${(pageCount > 0 ? `${pageCount} generated` : 'Existing docs only').padEnd(47)}║
║  System:    ${`${os.cpus()[0]?.model || 'Unknown'} (${os.cpus().length} cores)`.padEnd(47)}║
╚══════════════════════════════════════════════════════════╝
  `)

  let restoreBuildArtifacts: (() => void) | undefined

  try {
    // Preserve every directory this profiler may replace before generating
    // benchmark pages or starting a build.
    restoreBuildArtifacts = preserveBuildArtifacts()

    // Count the existing docs before adding generated benchmark pages so each
    // scenario reports the real denominator instead of only the CLI argument.
    const basePages = findMarkdownFiles(path.join(DOCS_DIR, 'docs')).length

    // Generate benchmark pages if requested.
    if (pageCount > 0) {
      generatePages(pageCount)
    }
    // Scenario 1: Cold build
    console.log(`\n${'='.repeat(60)}`)
    console.log('  SCENARIO 1: COLD BUILD')
    console.log('  Clean cache + dist, first build')
    console.log(`${'='.repeat(60)}`)
    const cold = await measureScenario(
      'Cold',
      turbo,
      true,
      basePages,
      pageCount,
    )

    // Scenario 2: Warm build (no changes)
    console.log(`\n${'='.repeat(60)}`)
    console.log('  SCENARIO 2: WARM BUILD')
    console.log(
      '  Same files, repeat build (should use cached client + server)',
    )
    console.log(`${'='.repeat(60)}`)
    const warm = await measureScenario(
      'Warm',
      turbo,
      false,
      basePages,
      pageCount,
    )

    // Scenario 3: Incremental build (one file changed)
    console.log(`\n${'='.repeat(60)}`)
    console.log('  SCENARIO 3: INCREMENTAL BUILD')
    console.log('  Modify one markdown file to test SSG cache')
    console.log(`${'='.repeat(60)}`)

    // Touch a random page to bump its mtime
    const docFiles = findMarkdownFiles(path.join(DOCS_DIR, 'docs'))
    let targetFile: string | undefined
    let originalContent: string | undefined
    if (docFiles.length > 0) {
      targetFile =
        docFiles.find((file) =>
          file.includes(`${path.sep}bench-gen${path.sep}`),
        ) || docFiles[0]
      originalContent = fs.readFileSync(targetFile, 'utf8')
      fs.appendFileSync(
        targetFile,
        '\n\n## Incremental benchmark edit\nThis content change measures one-page invalidation.\n',
      )
      console.log(`    Edited: ${path.relative(WORKSPACE_ROOT, targetFile)}`)
    }

    let incremental: BuildScenario
    try {
      incremental = await measureScenario(
        'Incremental',
        turbo,
        false,
        basePages,
        pageCount,
      )
    } finally {
      if (targetFile && originalContent !== undefined) {
        fs.writeFileSync(targetFile, originalContent, 'utf8')
      }
    }

    // Build profile object
    const profile: BuildProfile = {
      timestamp: new Date().toISOString(),
      pageCount,
      basePages,
      generatedPages: pageCount,
      totalPages: basePages + pageCount,
      turbo,
      scenarios: { cold, warm, incremental },
      output: {
        cold: {
          sizeBytes: cold.outputSizeBytes,
          fileCount: cold.outputFileCount,
          ssrBundleSizeBytes: cold.ssrBundleSizeBytes,
        },
        warm: {
          sizeBytes: warm.outputSizeBytes,
          fileCount: warm.outputFileCount,
          ssrBundleSizeBytes: warm.ssrBundleSizeBytes,
        },
        incremental: {
          sizeBytes: incremental.outputSizeBytes,
          fileCount: incremental.outputFileCount,
          ssrBundleSizeBytes: incremental.ssrBundleSizeBytes,
        },
      },
      breakdown: {
        clientBuildMs: -1,
        serverBuildMs: -1,
        renderPagesMs: -1,
        totalBuildMs: -1,
      },
      systemInfo: getSystemInfo(),
    }

    // Extract breakdown from cold build (most representative)
    const coldClient = cold.phases.find((p) => p.name === 'Client build')
    const coldServer = cold.phases.find((p) => p.name === 'Server build')
    const coldRender = cold.phases.find((p) => p.name === 'Render pages')
    const coldTotal =
      cold.phases.find((p) => p.name === 'SSGBuild') ||
      cold.phases.find((p) => p.name === 'Build Time')
    if (coldClient) profile.breakdown.clientBuildMs = coldClient.durationMs
    if (coldServer) profile.breakdown.serverBuildMs = coldServer.durationMs
    if (coldRender) profile.breakdown.renderPagesMs = coldRender.durationMs
    if (coldTotal) profile.breakdown.totalBuildMs = coldTotal.durationMs

    // Print phase comparison table
    console.log(`\n${'='.repeat(60)}`)
    console.log('  PHASE COMPARISON')
    console.log(`${'='.repeat(60)}`)
    console.log(
      `  ${'Phase'.padEnd(24)} ${'Cold'.padStart(10)} ${'Warm'.padStart(10)} ${'Increm.'.padStart(10)}`,
    )
    console.log(
      `  ${'─'.repeat(24)}─${'─'.repeat(10)}─${'─'.repeat(10)}─${'─'.repeat(10)}`,
    )

    const allPhaseNames = new Set<string>()
    for (const s of [cold, warm, incremental]) {
      for (const p of s.phases) allPhaseNames.add(p.name)
    }

    const fmt = (ms: number) =>
      ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`

    for (const name of [...allPhaseNames].sort()) {
      const coldP = cold.phases.find((p) => p.name === name)
      const warmP = warm.phases.find((p) => p.name === name)
      const incP = incremental.phases.find((p) => p.name === name)
      const coldStr = coldP ? fmt(coldP.durationMs) : '—'
      const warmStr = warmP ? fmt(warmP.durationMs) : '—'
      const incStr = incP ? fmt(incP.durationMs) : '—'
      console.log(
        `  ${name.padEnd(24)} ${coldStr.padStart(10)} ${warmStr.padStart(10)} ${incStr.padStart(10)}`,
      )
    }

    console.log(`\n  🏆 TOTALS:`)
    console.log(
      `     Cold:        ${(cold.totalDurationMs / 1000).toFixed(1)}s`,
    )
    console.log(
      `     Warm:        ${(warm.totalDurationMs / 1000).toFixed(1)}s (${cold.totalDurationMs > 0 ? `${((1 - warm.totalDurationMs / cold.totalDurationMs) * 100).toFixed(1)}% faster` : '—'})`,
    )
    console.log(
      `     Incremental: ${(incremental.totalDurationMs / 1000).toFixed(1)}s (${cold.totalDurationMs > 0 ? `${((1 - incremental.totalDurationMs / cold.totalDurationMs) * 100).toFixed(1)}% faster` : '—'})`,
    )

    // Save results
    const outDir = path.join(WORKSPACE_ROOT, '.boltdocs', 'benchmarks')
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true })
    }

    const fileName = `build-profile-${turbo ? 'turbo' : 'normal'}-${pageCount > 0 ? `${pageCount}p` : 'docs'}-${Date.now()}.json`
    const outPath = path.join(outDir, fileName)
    fs.writeFileSync(outPath, JSON.stringify(profile, null, 2))
    console.log(`\n  📁 Profile saved: ${outPath}`)
  } finally {
    // Always restore the original artifacts, even if cleanup itself fails.
    try {
      cleanupGeneratedPages()
      for (const directory of [
        path.join(DOCS_DIR, '.boltdocs'),
        path.join(DOCS_DIR, 'dist'),
      ]) {
        if (fs.existsSync(directory)) {
          fs.rmSync(directory, { recursive: true, force: true })
        }
      }
    } finally {
      restoreBuildArtifacts?.()
    }
  }

  console.log('\n  ✅ Profile complete\n')
}

main().catch((err) => {
  console.error('Profiler failed:', err)
  process.exit(1)
})
