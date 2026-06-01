import { colors } from './colors'
import { visibleLength } from './utils'
import type { BoxBorderStyle } from './box'

export interface TableColumnOptions {
  align?: 'left' | 'center' | 'right'
}

export interface TableOptions {
  style?: BoxBorderStyle | 'none'
  columns?: TableColumnOptions[] | Record<number, TableColumnOptions>
}

interface TableBorderChars {
  tl: string
  tr: string
  bl: string
  br: string
  h: string
  v: string
  tm: string
  bm: string
  ml: string
  mr: string
  mm: string
}

const TABLE_BORDERS: Record<
  Exclude<BoxBorderStyle, 'none'>,
  TableBorderChars
> = {
  single: {
    tl: '┏',
    tr: '┓',
    bl: '┗',
    br: '┛',
    h: '━',
    v: '┃',
    tm: '┳',
    bm: '┻',
    ml: '┣',
    mr: '┫',
    mm: '╋',
  },
  double: {
    tl: '╔',
    tr: '╗',
    bl: '╚',
    br: '╝',
    h: '═',
    v: '║',
    tm: '╦',
    bm: '╩',
    ml: '╠',
    mr: '╣',
    mm: '╬',
  },
  round: {
    tl: '╭',
    tr: '╮',
    bl: '╰',
    br: '╯',
    h: '─',
    v: '│',
    tm: '┬',
    bm: '┴',
    ml: '├',
    mr: '┤',
    mm: '┼',
  },
}

function padCell(
  text: string,
  width: number,
  align: 'left' | 'center' | 'right',
): string {
  const len = visibleLength(text)
  const pad = Math.max(0, width - len)
  if (align === 'right') {
    return ' '.repeat(pad) + text
  }
  if (align === 'center') {
    return (
      ' '.repeat(Math.floor(pad / 2)) + text + ' '.repeat(Math.ceil(pad / 2))
    )
  }
  return text + ' '.repeat(pad)
}

export function table(
  headers: string[],
  rows: string[][],
  opts?: TableOptions,
): string {
  const style = opts?.style ?? 'single'

  const colCount = Math.max(headers.length, ...rows.map((r) => r.length))
  if (colCount === 0) return ''

  const colWidths = Array(colCount).fill(0)
  for (let c = 0; c < colCount; c++) {
    let max = headers[c] ? visibleLength(headers[c]) : 0
    for (const row of rows) {
      const cell = row[c] ?? ''
      const cellLen = visibleLength(cell)
      if (cellLen > max) {
        max = cellLen
      }
    }
    colWidths[c] = max + 2
  }

  const formatCells = (cells: string[]) => {
    const formatted: string[] = []
    for (let c = 0; c < colCount; c++) {
      const cellText = cells[c] ?? ''
      const align = opts?.columns?.[c]?.align ?? 'left'
      const innerW = colWidths[c] - 2
      const padded = padCell(cellText, innerW, align)
      formatted.push(' ' + padded + ' ')
    }
    return formatted
  }

  const result: string[] = []

  if (style === 'none') {
    if (headers.length > 0) {
      result.push(formatCells(headers.map((h) => colors.bold(h))).join('  '))
    }
    for (const row of rows) {
      result.push(formatCells(row).join('  '))
    }
    return result.join('\n')
  }

  const b =
    TABLE_BORDERS[style as Exclude<BoxBorderStyle, 'none'>] ??
    TABLE_BORDERS.single

  const topParts: string[] = []
  for (let c = 0; c < colCount; c++) {
    topParts.push(b.h.repeat(colWidths[c]))
  }
  result.push(b.tl + topParts.join(b.tm) + b.tr)

  if (headers.length > 0) {
    const boldHeaders = headers.map((h) => colors.bold(h))
    const formattedHeaders = formatCells(boldHeaders)
    result.push(b.v + formattedHeaders.join(b.v) + b.v)

    const midParts: string[] = []
    for (let c = 0; c < colCount; c++) {
      midParts.push(b.h.repeat(colWidths[c]))
    }
    result.push(b.ml + midParts.join(b.mm) + b.mr)
  }

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]
    const formattedRow = formatCells(row)
    result.push(b.v + formattedRow.join(b.v) + b.v)
  }

  const botParts: string[] = []
  for (let c = 0; c < colCount; c++) {
    botParts.push(b.h.repeat(colWidths[c]))
  }
  result.push(b.bl + botParts.join(b.bm) + b.br)

  return result.join('\n')
}
