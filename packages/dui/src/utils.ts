export function padCenter(s: string, w: number): string {
  const pad = Math.max(0, w - s.length)
  return ' '.repeat(Math.floor(pad / 2)) + s + ' '.repeat(Math.ceil(pad / 2))
}

export function padLeft(s: string, w: number): string {
  return s + ' '.repeat(Math.max(0, w - s.length))
}

export function fitWidth(s: string, w: number): string {
  if (s.length >= w) return s
  return s + ' '.repeat(w - s.length)
}

export function terminalWidth(): number {
  if (typeof process !== 'undefined' && process.stdout?.columns) {
    return process.stdout.columns
  }
  return 80
}

export function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '')
}

export function visibleLength(s: string): number {
  return stripAnsi(s).length
}
