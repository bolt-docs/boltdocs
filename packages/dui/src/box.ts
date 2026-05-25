import { colors } from './colors'
import { padCenter, fitWidth, terminalWidth } from './utils'

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

function buildLines(lines: string[], opts: BoxOptions): string {
  const b = BORDERS[opts.style ?? 'double']
  const pad = opts.padding ?? 1
  const innerPad = ' '.repeat(pad)
  const result: string[] = []

  if (opts.title) {
    const titleMax = (opts.width! - 4)
    const title = opts.title.length > titleMax ? opts.title.slice(0, titleMax - 1) + '…' : opts.title
    const remaining = Math.max(0, opts.width! - title.length - 5)
    result.push(b.tl + b.h + ` ${colors.bold(title)} ` + b.h.repeat(remaining) + b.tr)
    result.push(`${b.v}${' '.repeat(opts.width!)}${b.v}`)
  } else {
    result.push(b.tl + b.h.repeat(opts.width!) + b.tr)
  }

  for (const line of lines) {
    const inner = innerPad + line + innerPad
    const padded = fitWidth(inner, opts.width!)
    result.push(`${b.v}${padded}${b.v}`)
  }

  if (opts.title) {
    result.push(`${b.v}${' '.repeat(opts.width!)}${b.v}`)
  }

  result.push(b.bl + b.h.repeat(opts.width!) + b.br)
  return result.join('\n')
}

export function box(lines: string[], opts?: BoxOptions): string {
  const style = opts?.style ?? 'double'
  const padding = opts?.padding ?? 1
  const maxContent = lines.reduce((m, l) => Math.max(m, l.length), 0)
  const titleLen = opts?.title ? opts.title.length + 2 : 0
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

  const lines: string[] = [
    `  ${colors.green('➜')}  ${colors.green('Local:')}   ${colors.cyan(localUrl)}`,
    netLine,
    '',
    `  ${colors.dim('press h + enter for help')}`,
  ]

  const b = BORDERS['double']
  const result: string[] = []
  const title = 'boltdocs dev server'
  const remaining = Math.max(0, W - title.length - 3)
  result.push(b.tl + b.h + ` ${colors.bold(title)} ` + b.h.repeat(remaining) + b.tr)
  result.push(`${b.v}${' '.repeat(W)}${b.v}`)

  for (const line of lines) {
    if (line.length === 0) {
      result.push(`${b.v}${' '.repeat(W)}${b.v}`)
    } else {
      const rawLen = line.replace(/\x1b\[[0-9;]*m/g, '').length
      const padding = W - 1 - rawLen
      result.push(`${b.v} ${line}${' '.repeat(Math.max(0, padding))}${b.v}`)
    }
  }

  result.push(b.bl + b.h.repeat(W) + b.br)
  return '\n' + result.join('\n') + '\n'
}

export function previewServer(localUrl: string, networkUrl: string | null): string {
  const W = Math.min(terminalWidth(), 60)
  const netLine = networkUrl
    ? `  ${colors.green('➜')}  ${colors.green('Network:')} ${colors.cyan(networkUrl)}`
    : `  ${colors.green('➜')}  ${colors.green('Network:')} ${colors.gray('use --host to expose')}`

  const lines: string[] = [
    `  ${colors.green('➜')}  ${colors.green('Local:')}   ${colors.cyan(localUrl)}`,
    netLine,
  ]

  const b = BORDERS['double']
  const result: string[] = []
  const title = 'boltdocs preview server'
  const remaining = Math.max(0, W - title.length - 3)
  result.push(b.tl + b.h + ` ${colors.bold(title)} ` + b.h.repeat(remaining) + b.tr)
  result.push(`${b.v}${' '.repeat(W)}${b.v}`)

  for (const line of lines) {
    const rawLen = line.replace(/\x1b\[[0-9;]*m/g, '').length
    const padding = W - 1 - rawLen
    result.push(`${b.v} ${line}${' '.repeat(Math.max(0, padding))}${b.v}`)
  }

  result.push(b.bl + b.h.repeat(W) + b.br)
  return '\n' + result.join('\n') + '\n'
}

export function updateAvailable(current: string, latest: string): string {
  const W = Math.min(terminalWidth(), 54)

  const lines: string[] = [
    padCenter('🚀  Update available!', W),
    '',
    `  ${colors.dim('Current:')} ${colors.red(current)}  ${colors.gray('→')}  ${colors.green(latest)}`,
    '',
    `  ${colors.dim('Run:')}  ${colors.bold('npm install boltdocs@latest')}`,
  ]

  const b = BORDERS['double']
  const result: string[] = []
  result.push(b.tl + b.h.repeat(W) + b.tr)

  for (const line of lines) {
    if (line.length === 0) {
      result.push(`${b.v}${' '.repeat(W)}${b.v}`)
    } else {
      const rawLen = line.replace(/\x1b\[[0-9;]*m/g, '').length
      const padding = W - rawLen
      result.push(`${b.v}${line}${' '.repeat(Math.max(0, padding))}${b.v}`)
    }
  }

  result.push(b.bl + b.h.repeat(W) + b.br)
  return '\n' + result.join('\n') + '\n'
}
