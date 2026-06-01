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

/** Truncates `s` to `max` visible characters, appending '…' if needed. */
function truncate(s: string, max: number): string {
  return visibleLength(s) > max ? s.slice(0, max - 1) + '…' : s
}

function buildBoxBase(
  lines: string[],
  opts: {
    title?: string
    width: number
    style: BoxBorderStyle
    padLine: (line: string, innerWidth: number) => string
    addVerticalSpacers?: boolean
  },
): string {
  const b = BORDERS[opts.style]
  const result: string[] = []

  if (opts.title) {
    const title = truncate(opts.title, opts.width - 4)
    const titleLen = visibleLength(title)
    const remaining = Math.max(0, opts.width - titleLen - 3)
    result.push(
      b.tl + b.h + ` ${colors.bold(title)} ` + b.h.repeat(remaining) + b.tr,
    )
    if (opts.addVerticalSpacers) {
      result.push(`${b.v}${' '.repeat(opts.width)}${b.v}`)
    }
  } else {
    result.push(b.tl + b.h.repeat(opts.width) + b.tr)
  }

  for (const line of lines) {
    const content = opts.padLine(line, opts.width)
    result.push(`${b.v}${content}${b.v}`)
  }

  if (opts.title && opts.addVerticalSpacers) {
    result.push(`${b.v}${' '.repeat(opts.width)}${b.v}`)
  }

  result.push(b.bl + b.h.repeat(opts.width) + b.br)
  return result.join('\n')
}

function buildServerBox(title: string, lines: string[], W: number): string {
  const str = buildBoxBase(lines, {
    title,
    width: W,
    style: 'double',
    addVerticalSpacers: true,
    padLine: (line, innerWidth) => {
      if (line.length === 0) {
        return ' '.repeat(innerWidth)
      }
      const padding = innerWidth - 1 - visibleLength(line)
      return ` ${line}${' '.repeat(Math.max(0, padding))}`
    },
  })
  return '\n' + str + '\n'
}

export function box(lines: string[], opts?: BoxOptions): string {
  const style = opts?.style ?? 'double'
  const padding = opts?.padding ?? 1
  const maxContent = lines.reduce((m, l) => Math.max(m, visibleLength(l)), 0)
  const titleLen = opts?.title ? visibleLength(opts.title) + 2 : 0
  const minWidth = Math.max(maxContent + padding * 2, titleLen + 2, 20)
  const termWidth = Math.min(terminalWidth(), 80)
  const width = opts?.width
    ? Math.min(opts.width, termWidth)
    : Math.min(minWidth, termWidth)

  return buildBoxBase(lines, {
    title: opts?.title,
    width,
    style,
    addVerticalSpacers: true,
    padLine: (line, innerWidth) => {
      const innerPad = ' '.repeat(padding)
      return fitWidth(innerPad + line + innerPad, innerWidth)
    },
  })
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

  return buildServerBox(
    getConfig().devServerTitle,
    [
      `  ${colors.green('➜')}  ${colors.green('Local:')}   ${colors.cyan(localUrl)}`,
      netLine,
      '',
      `  ${colors.dim('press h + enter for help')}`,
    ],
    W,
  )
}

export function previewServer(
  localUrl: string,
  networkUrl: string | null,
): string {
  const W = Math.min(terminalWidth(), 60)
  const netLine = networkUrl
    ? `  ${colors.green('➜')}  ${colors.green('Network:')} ${colors.cyan(networkUrl)}`
    : `  ${colors.green('➜')}  ${colors.green('Network:')} ${colors.gray('use --host to expose')}`

  return buildServerBox(
    getConfig().previewServerTitle,
    [
      `  ${colors.green('➜')}  ${colors.green('Local:')}   ${colors.cyan(localUrl)}`,
      netLine,
    ],
    W,
  )
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

  const str = buildBoxBase(lines, {
    width: W,
    style: 'double',
    padLine: (line, innerWidth) => {
      if (line.length === 0) {
        return ' '.repeat(innerWidth)
      }
      const padding = innerWidth - visibleLength(line)
      return `${line}${' '.repeat(Math.max(0, padding))}`
    },
  })
  return '\n' + str + '\n'
}
