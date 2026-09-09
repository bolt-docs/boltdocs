/**
 * Benchmark regression gate.
 *
 * Compares the latest cold-build result (produced by profile-build.ts) against
 * a committed baseline and FAILS (exit 1) when it regresses beyond the allowed
 * threshold. This turns SPEC §2.2 — "cold build must improve or hold against
 * the previous published run" — into an automated, reviewable check.
 *
 * The script never runs a build itself; it consumes the JSON ground by
 * `profile-build.ts` and the baseline committed at scripts/benchmarks/baseline.json.
 *
 * Usage:
 *   tsx scripts/benchmarks/gate.ts                  # compare latest vs committed baseline
 *   tsx scripts/benchmarks/gate.ts --write           # re-baseline (fastest recent result), use with care
 *   tsx scripts/benchmarks/gate.ts --threshold 15     # allow up to 15% regression
 *   tsx scripts/benchmarks/gate.ts --out <dir>        # where to look for cold-build profiles
 *   tsx scripts/benchmarks/gate.ts --baseline <path>  # custom baseline file
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..')

const DEFAULT_BASELINE = path.join(
  WORKSPACE_ROOT,
  'scripts',
  'benchmarks',
  'baseline.json',
)
const DEFAULT_OUT = path.join(WORKSPACE_ROOT, '.boltdocs', 'benchmarks')

interface ProfileSummary {
  timestamp?: string
  mode?: string
  medianTotalMs?: number
}

interface BaselineRecord {
  createdAt: string
  medianTotalMs: number
}

function numberArg(args: string[], flag: string, fallback: number): number {
  const i = args.indexOf(flag)
  const raw = i >= 0 ? Number(args[i + 1]) : Number.NaN
  return Number.isFinite(raw) && raw >= 0 ? raw : fallback
}

function parseArgs() {
  const args = process.argv.slice(2)
  const flag = (name: string): string | null => {
    const i = args.indexOf(name)
    return i >= 0 && args[i + 1] ? args[i + 1] : null
  }
  return {
    write: args.includes('--write'),
    thresholdPct: numberArg(args, '--threshold', 10),
    baselinePath: flag('--baseline') ?? DEFAULT_BASELINE,
    outDir: flag('--out') ?? DEFAULT_OUT,
  }
}

function latestColdProfile(outDir: string): ProfileSummary | null {
  if (!fs.existsSync(outDir)) return null
  let best: ProfileSummary | null = null
  let bestTs = -1
  for (const entry of fs.readdirSync(outDir)) {
    if (!entry.endsWith('.json')) continue
    let parsed: ProfileSummary
    try {
      parsed = JSON.parse(fs.readFileSync(path.join(outDir, entry), 'utf-8'))
    } catch {
      continue
    }
    if (parsed.mode !== 'cold' || typeof parsed.medianTotalMs !== 'number') {
      continue
    }
    const ts = parsed.timestamp ? Date.parse(parsed.timestamp) : 0
    if (ts >= bestTs) {
      best = parsed
      bestTs = ts
    }
  }
  return best
}

function loadBaseline(file: string): BaselineRecord | null {
  if (!fs.existsSync(file)) return null
  try {
    const raw: unknown = JSON.parse(fs.readFileSync(file, 'utf-8'))
    if (typeof raw !== 'object' || raw === null) return null
    const record = raw as Record<string, unknown>
    if (typeof record.medianTotalMs !== 'number') return null
    return {
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : '',
      medianTotalMs: record.medianTotalMs,
    }
  } catch {
    return null
  }
}

function writeBaseline(file: string, medianMs: number): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const record: BaselineRecord = {
    createdAt: new Date().toISOString(),
    medianTotalMs: Math.round(medianMs),
  }
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`)
}

function fmt(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`
}

function deltaPct(current: number, baseline: number): number {
  return ((current - baseline) / baseline) * 100
}

function main(): void {
  const opts = parseArgs()

  const current = latestColdProfile(opts.outDir)
  if (!current) {
    console.error(
      `[gate] No cold-build profile found in "${opts.outDir}".\n` +
        '       Run `pnpm run benchmark` or `tsx scripts/benchmarks/profile-build.ts` first.',
    )
    process.exit(1)
  }
  const currentMs = Math.round(current.medianTotalMs ?? 0)

  const baseline = opts.write ? null : loadBaseline(opts.baselinePath)

  if (!baseline) {
    writeBaseline(opts.baselinePath, currentMs)
    console.log(
      `[gate] No committed baseline found — wrote one: ${fmt(currentMs)}`,
    )
    console.log(`       Saved to ${opts.baselinePath}`)
    console.log(
      '       Review and commit it; subsequent runs enforce the gate.',
    )
    return
  }

  const limit = baseline.medianTotalMs * (1 + opts.thresholdPct / 100)
  const ok = currentMs <= limit
  const delta = deltaPct(currentMs, baseline.medianTotalMs)

  console.log(`[gate] Current cold build  : ${fmt(currentMs)}`)
  console.log(`[gate] Baseline (committed): ${fmt(baseline.medianTotalMs)}`)
  console.log(
    `[gate] Allowed regression  : +${opts.thresholdPct}% (<= ${fmt(limit)})`,
  )
  console.log(
    `[gate] Delta vs baseline   : ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`,
  )

  if (!ok) {
    console.error(
      `\n[gate] REJECTED: cold build regressed by ${delta.toFixed(1)}% — ` +
        'must improve or hold (SPEC §2.2).',
    )
    process.exit(1)
  }

  console.log(
    '\n[gate] ACCEPTED: cold build holds or improves vs baseline (SPEC §2.2).',
  )
}

main()
