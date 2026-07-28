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
}

interface BuildProfile {
  timestamp: string
  pageCount: number
  turbo: boolean
  scenarios: {
    cold: BuildScenario
    warm: BuildScenario
    incremental: BuildScenario
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

function runBuild(
  turbo: boolean,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const args = ['build', '--filter', 'docs']

    const child = spawn('pnpm', args, {
      cwd: WORKSPACE_ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        BOLTDOCS_TURBO: turbo ? 'true' : 'false',
      },
    })

    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(
      () => {
        child.kill('SIGTERM')
        setTimeout(() => child.kill('SIGKILL'), 5000)
        reject(new Error('Build timed out after 5 minutes'))
      },
      5 * 60 * 1000,
    )

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
      reject(err)
    })

    child.on('close', (exitCode) => {
      clearTimeout(timeout)
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
    const stepMatch = line.match(
      /[✓✔]\s+(.+?)\s+[\.\s]+\s*(\d+\.?\d*)\s*(ms|s)/,
    )
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

async function measureScenario(
  label: string,
  turbo: boolean,
  cleanCache: boolean,
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

  const start = performance.now()
  const { stdout, stderr, exitCode } = await runBuild(turbo)
  const totalMs = performance.now() - start

  if (exitCode !== 0) {
    console.error(`    ❌ Build failed (exit ${exitCode})`)
    const errMsg = stderr.slice(0, 500)
    return { label, totalDurationMs: totalMs, phases: [], success: false }
  }

  const phases = extractPhaseTimings(stdout)
  console.log(
    `    ✅ ${(totalMs / 1000).toFixed(1)}s total (${phases.length} phases parsed)`,
  )

  return { label, totalDurationMs: totalMs, phases, success: true }
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

  // Generate benchmark pages if requested
  if (pageCount > 0) {
    generatePages(pageCount)
  }

  try {
    // Scenario 1: Cold build
    console.log(`\n${'='.repeat(60)}`)
    console.log('  SCENARIO 1: COLD BUILD')
    console.log('  Clean cache + dist, first build')
    console.log(`${'='.repeat(60)}`)
    const cold = await measureScenario('Cold', turbo, true)

    // Scenario 2: Warm build (no changes)
    console.log(`\n${'='.repeat(60)}`)
    console.log('  SCENARIO 2: WARM BUILD')
    console.log(
      '  Same files, repeat build (should use cached client + server)',
    )
    console.log(`${'='.repeat(60)}`)
    const warm = await measureScenario('Warm', turbo, false)

    // Scenario 3: Incremental build (one file changed)
    console.log(`\n${'='.repeat(60)}`)
    console.log('  SCENARIO 3: INCREMENTAL BUILD')
    console.log('  Modify one markdown file to test SSG cache')
    console.log(`${'='.repeat(60)}`)

    // Touch a random page to bump its mtime
    const docFiles = fs
      .readdirSync(path.join(DOCS_DIR, 'docs'))
      .filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
    if (docFiles.length > 0) {
      const targetFile = path.join(DOCS_DIR, 'docs', docFiles[0])
      const now = new Date()
      fs.utimesSync(targetFile, now, now)
      console.log(`    Touched: ${docFiles[0]}`)
    }

    const incremental = await measureScenario('Incremental', turbo, false)

    // Build profile object
    const profile: BuildProfile = {
      timestamp: new Date().toISOString(),
      pageCount,
      turbo,
      scenarios: { cold, warm, incremental },
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
    const coldTotal = cold.phases.find((p) => p.name === 'Pipeline Total')
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
    // Always clean up generated pages
    cleanupGeneratedPages()
  }

  console.log('\n  ✅ Profile complete\n')
}

main().catch((err) => {
  console.error('Profiler failed:', err)
  process.exit(1)
})
