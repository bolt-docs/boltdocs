import { colors } from './colors'
import { padCenter, fitWidth, terminalWidth, visibleLength } from './utils'
import { getConfig } from './config'

export type BoxBorderStyle = 'single' | 'double' | 'round'

interface BorderChars {
  tl: string
  tr: string
  bl: string
  br: string
  h: string
  v: string
}

const BORDERS: Record<BoxBorderStyle, BorderChars> = {
  single: { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
  double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
  round: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
}

export interface BoxOptions {
  title?: string
  width?: number
  style?: BoxBorderStyle
  padding?: number
}

// Internal resolved options — all required fields after normalization in box()
interface ResolvedBoxOptions {
  title?: string
  width: number
  style: BoxBorderStyle
  padding: number
}

/** Truncates `s` to `max` visible characters, appending '…' if needed. */
function truncate(s: string, max: number): string {
  return visibleLength(s) > max ? s.slice(0, max - 1) + '…' : s
}

function buildLines(lines: string[], opts: ResolvedBoxOptions): string {
  const b = BORDERS[opts.style]
  const pad = opts.padding
  const innerPad = ' '.repeat(pad)
  const result: string[] = []

  if (opts.title) {
    const title = truncate(opts.title, opts.width - 4)
    const titleLen = visibleLength(title)
    // Total line = tl(1) + h(1) + space(1) + title + space(1) + remaining + tr(1)
    // Must equal opts.width + 2 → remaining = opts.width - titleLen - 3
    const remaining = Math.max(0, opts.width - titleLen - 3)
    result.push(b.tl + b.h + ` ${colors.bold(title)} ` + b.h.repeat(remaining) + b.tr)
    result.push(`${b.v}${' '.repeat(opts.width)}${b.v}`)
  } else {
    result.push(b.tl + b.h.repeat(opts.width) + b.tr)
  }

  for (const line of lines) {
    const inner = innerPad + line + innerPad
    const padded = fitWidth(inner, opts.width)
    result.push(`${b.v}${padded}${b.v}`)
  }

  if (opts.title) {
    result.push(`${b.v}${' '.repeat(opts.width)}${b.v}`)
  }

  result.push(b.bl + b.h.repeat(opts.width) + b.br)
  return result.join('\n')
}

function buildServerBox(title: string, lines: string[], W: number): string {
  const b = BORDERS['double']
  const result: string[] = []
  const titleLen = visibleLength(title)
  const remaining = Math.max(0, W - titleLen - 3)
  result.push(b.tl + b.h + ` ${colors.bold(title)} ` + b.h.repeat(remaining) + b.tr)
  result.push(`${b.v}${' '.repeat(W)}${b.v}`)

  for (const line of lines) {
    if (line.length === 0) {
      result.push(`${b.v}${' '.repeat(W)}${b.v}`)
    } else {
      const padding = W - 1 - visibleLength(line)
      result.push(`${b.v} ${line}${' '.repeat(Math.max(0, padding))}${b.v}`)
    }
  }

  result.push(b.bl + b.h.repeat(W) + b.br)
  return '\n' + result.join('\n') + '\n'
}

export function box(lines: string[], opts?: BoxOptions): string {
  const style = opts?.style ?? 'double'
  const padding = opts?.padding ?? 1
  const maxContent = lines.reduce((m, l) => Math.max(m, visibleLength(l)), 0)
  const titleLen = opts?.title ? visibleLength(opts.title) + 2 : 0
  const minWidth = Math.max(maxContent + padding * 2, titleLen + 2, 20)
  const termWidth = Math.min(terminalWidth(), 80)
  const width = opts?.width ? Math.min(opts.width, termWidth) : Math.min(minWidth, termWidth)

  return buildLines(lines, { ...opts, style, padding, width })
}

export function double(title: string, lines: string[]): string {
  return box(lines, { title, style: 'double' })
}

export function single(title: string, lines: string[]): string {
  return box(lines, { title, style: 'single' })
}

export function round(title: string, lines: string[]): string {
  return box(lines, { title, style: 'round' })
}

export function devServer(localUrl: string, networkUrl: string | null): string {
  const W = Math.min(terminalWidth(), 60)
  const netLine = networkUrl
    ? `  ${colors.green('➜')}  ${colors.green('Network:')} ${colors.cyan(networkUrl)}`
    : `  ${colors.green('➜')}  ${colors.green('Network:')} ${colors.gray('use --host to expose')}`

  return buildServerBox(getConfig().devServerTitle, [
    `  ${colors.green('➜')}  ${colors.green('Local:')}   ${colors.cyan(localUrl)}`,
    netLine,
    '',
    `  ${colors.dim('press h + enter for help')}`,
  ], W)
}

export function previewServer(localUrl: string, networkUrl: string | null): string {
  const W = Math.min(terminalWidth(), 60)
  const netLine = networkUrl
    ? `  ${colors.green('➜')}  ${colors.green('Network:')} ${colors.cyan(networkUrl)}`
    : `  ${colors.green('➜')}  ${colors.green('Network:')} ${colors.gray('use --host to expose')}`

  return buildServerBox(getConfig().previewServerTitle, [
    `  ${colors.green('➜')}  ${colors.green('Local:')}   ${colors.cyan(localUrl)}`,
    netLine,
  ], W)
}

export function updateAvailable(current: string, latest: string): string {
  const W = Math.min(terminalWidth(), 54)

  const lines: string[] = [
    padCenter('🚀  Update available!', W),
    '',
    `  ${colors.dim('Current:')} ${colors.red(current)}  ${colors.gray('→')}  ${colors.green(latest)}`,
    '',
    `  ${colors.dim('Run:')}  ${colors.bold(getConfig().updateCommand)}`,
  ]

  const b = BORDERS['double']
  const result: string[] = []
  result.push(b.tl + b.h.repeat(W) + b.tr)

  for (const line of lines) {
    if (line.length === 0) {
      result.push(`${b.v}${' '.repeat(W)}${b.v}`)
    } else {
      const padding = W - visibleLength(line)
      result.push(`${b.v}${line}${' '.repeat(Math.max(0, padding))}${b.v}`)
    }
  }

  result.push(b.bl + b.h.repeat(W) + b.br)
  return '\n' + result.join('\n') + '\n'
}
