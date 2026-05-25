import picocolors from 'picocolors'

export { picocolors as colors }

export const colorMap: Record<string, (s: string) => string> = {
  red: picocolors.red,
  green: picocolors.green,
  yellow: picocolors.yellow,
  blue: picocolors.blue,
  cyan: picocolors.cyan,
  magenta: picocolors.magenta,
  gray: picocolors.gray,
  bold: picocolors.bold,
  dim: picocolors.dim,
  italic: picocolors.italic,
  underline: picocolors.underline,
  reset: picocolors.reset,
}
