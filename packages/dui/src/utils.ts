import stringWidth from 'string-width'

const ANSI_RE =
  /[\u001b\u009b](?:\[[0-9;:<=>?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)|[@-Z\\-_])/g

export function stripAnsi(s: string): string {
  return s.replace(ANSI_RE, '')
}

export function visibleLength(s: string): number {
  return stringWidth(s)
}

export function padCenter(s: string, w: number): string {
  const len = visibleLength(s)
  const pad = Math.max(0, w - len)
  return ' '.repeat(Math.floor(pad / 2)) + s + ' '.repeat(Math.ceil(pad / 2))
}

export function fitWidth(s: string, w: number): string {
  const len = visibleLength(s)
  if (len >= w) return s
  return s + ' '.repeat(w - len)
}

/** Right-pads `s` with spaces to reach width `w` (left-aligns the string). */
export function padRight(s: string, w: number): string {
  return fitWidth(s, w)
}

export function terminalWidth(): number {
  if (typeof process !== 'undefined' && process.stdout?.columns) {
    return process.stdout.columns
  }
  return 80
}
