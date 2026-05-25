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

/** Raw ANSI escape codes for backward compatibility with string-concatenation patterns. */
export const ansiCodes = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
}
