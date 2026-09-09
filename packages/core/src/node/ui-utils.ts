import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  colors,
  round,
  badge,
  kbd,
  colorize,
  gradient,
  isColorSupported,
  isPlainMode,
} from '@bdocs/dui'

/**
 * Brand azure-blue ramp (primary palette in `neutral.css`):
 * primary-300 #95c0ff → primary-500 #3d8bfa → primary-600 #2769db.
 */
const BRAND_RAMP = [
  { pos: 0, color: '#95c0ff' },
  { pos: 0.55, color: '#3d8bfa' },
  { pos: 1, color: '#2769db' },
] as const

export const BRAND = '#3d8bfa'
export const BRAND_DEEP = '#2769db'
const SERVER_BORDER = BRAND

export function gradientWordmark(word: string): string {
  if (!isColorSupported || isPlainMode()) return word
  const palette = gradient(word.length, [...BRAND_RAMP])
  return [...word].map((ch, i) => colorize(ch, palette[i], 'fg')).join('')
}

/** Brand-colored chip — deep blue for secondary accents. */
export function brandBadge(label: string, deep = false): string {
  return badge({
    label,
    colors: { text: '#ffffff', bg: deep ? BRAND_DEEP : BRAND },
  })
}

function brandDot(): string {
  return isColorSupported && !isPlainMode() ? colorize('●', BRAND, 'fg') : '●'
}

function formatDuration(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`
}

/**
 * Turns pipeline step names (`ConfigResolve`, `SSGBuild`) into readable
 * labels (`Config resolve`, `SSG build`).
 */
function formatStepName(name: string): string {
  const words = name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(' ')
  return words
    .map((word, index) => {
      if (index === 0) return word
      return /^[A-Z0-9]{2,}$/.test(word) ? word : word.toLowerCase()
    })
    .join(' ')
}

/**
 * Read the boltdocs version from package.json (works in source, tests and
 * the bundled dist by walking up from the current module location).
 */
function getBoltdocsVersion(): string {
  const currentFile = fileURLToPath(import.meta.url)
  let dir = path.dirname(currentFile)
  for (let i = 0; i < 8; i++) {
    try {
      const pkgPath = path.join(dir, 'package.json')
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      if (pkg.name === 'boltdocs' && typeof pkg.version === 'string') {
        return pkg.version
      }
    } catch {
      // keep walking up
    }
    dir = path.dirname(dir)
  }
  return ''
}

export const BOLTDOCS_VERSION = getBoltdocsVersion()

export interface ServerBoxOptions {
  /** Elapsed milliseconds to display as "ready in …". */
  readyIn?: number
}

function serverBox(
  mode: 'dev' | 'preview',
  localUrl: string,
  networkUrl: string | null,
  options: ServerBoxOptions = {},
): string {
  const netText = networkUrl
    ? colors.dim(networkUrl)
    : colors.gray('use --host to expose')
  const labelCol = (label: string) => colors.dim(label.padEnd(9))
  const dot = brandDot()

  const lines = [
    `${dot}  ${labelCol('Local')}${colorize(localUrl, BRAND, 'fg')}`,
    `${dot}  ${labelCol('Network')}${netText}`,
  ]

  if (mode === 'dev') {
    lines.push(
      '',
      `${kbd({ keys: ['h', 'Enter'] })}  ${colors.dim('show help')}`,
    )
  }

  const ready =
    options.readyIn !== undefined
      ? ` ${colors.dim(`ready in ${formatDuration(options.readyIn)}`)}`
      : ''

  const badgeLabel = mode === 'dev' ? 'DEV' : 'PREVIEW'
  const versionBadge = BOLTDOCS_VERSION
    ? ` ${brandBadge(`v${BOLTDOCS_VERSION}`, mode === 'preview')}`
    : ''

  return (
    '\n' +
    `  ${colors.bold('⚡')} ${gradientWordmark('boltdocs')}${versionBadge} ${colors.dim('—')} ${colors.bold(mode === 'dev' ? 'dev server' : 'preview server')}${ready}\n\n` +
    round(lines, {
      title: brandBadge(badgeLabel, mode === 'preview'),
      colors: { border: SERVER_BORDER },
    }) +
    '\n'
  )
}

export function devServer(
  localUrl: string,
  networkUrl: string | null,
  options: ServerBoxOptions = {},
): string {
  return serverBox('dev', localUrl, networkUrl, options)
}

export function previewServer(
  localUrl: string,
  networkUrl: string | null,
  options: ServerBoxOptions = {},
): string {
  return serverBox('preview', localUrl, networkUrl, options)
}

export function updateAvailable(current: string, latest: string): string {
  const labelCol = (label: string) => colors.dim(label.padEnd(9))
  const dot = brandDot()
  const lines = [
    `${dot}  ${labelCol('Current')}${colors.red(current)}  ${colors.gray('→')}  ${colors.green(latest)}`,
    '',
    `${dot}  ${labelCol('Install')}${colors.bold('npm install boltdocs@latest')}`,
  ]

  return (
    '\n' +
    `  ${colors.bold('⚡')} ${gradientWordmark('boltdocs')} ${colors.dim('—')} ${colors.bold('update available')}\n\n` +
    round(lines, {
      title: brandBadge('UPDATE', true),
      colors: { border: SERVER_BORDER },
    }) +
    '\n'
  )
}

export interface BuildStepSummary {
  name: string
  success: boolean
  duration?: number
  details?: string
}

export interface BuildSummaryOptions {
  /** Elapsed milliseconds for the whole pipeline. */
  totalMs: number
  steps: BuildStepSummary[]
  pages?: number
  jsSize?: string
  cssSize?: string
  outDir?: string
}

/**
 * Compact, single-block build summary. One write to stdout instead of the
 * former steps + divider + total + table + box sequence.
 */
export function buildSummary(options: BuildSummaryOptions): string {
  const totalTime = formatDuration(options.totalMs)
  const versionBadge = BOLTDOCS_VERSION
    ? ` ${brandBadge(`v${BOLTDOCS_VERSION}`)}`
    : ''

  const lines: string[] = []
  lines.push(
    `  ${colors.bold('⚡')} ${gradientWordmark('boltdocs')}${versionBadge} ${colors.dim('—')} ${colors.bold('build completed')} ${colors.dim(`in ${totalTime}`)}`,
  )

  if (options.steps.length > 0) {
    const stepLabels = options.steps.map((step) => formatStepName(step.name))
    const labelWidth = Math.max(...stepLabels.map((label) => label.length)) + 2
    lines.push('')
    options.steps.forEach((step, index) => {
      const icon = step.success ? colors.green('✔') : colors.red('✘')
      const duration =
        step.duration !== undefined
          ? colors.dim(formatDuration(step.duration))
          : ''
      const details = step.details ? colors.dim(` · ${step.details}`) : ''
      lines.push(
        `  ${icon} ${stepLabels[index].padEnd(labelWidth)}${duration}${details}`,
      )
    })
  }

  const summaryParts: string[] = []
  if (options.pages !== undefined) {
    summaryParts.push(
      `${options.pages} ${options.pages === 1 ? 'page' : 'pages'}`,
    )
  }
  if (options.jsSize) summaryParts.push(`JS ${options.jsSize}`)
  if (options.cssSize) summaryParts.push(`CSS ${options.cssSize}`)
  if (options.outDir) summaryParts.push(`→ ${options.outDir}`)

  if (summaryParts.length > 0) {
    lines.push('')
    const label = 'Build summary'
    const gap = Math.max(4, 30 - label.length)
    lines.push(
      `  ${colorize(label, BRAND, 'fg')} ${colors.dim('─'.repeat(gap))}`,
    )
    lines.push(`  ${summaryParts.join(colors.dim(' · '))}`)
  }

  return `\n${lines.join('\n')}\n`
}
