import readline from 'node:readline'
import * as dui from '@bdocs/dui'

/**
 * ANSI Escape sequences for terminal coloring and styling.
 * Kept for backward compatibility with callers that use ANSI concatenation.
 */
export const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  dim: '\x1b[2m',
  magenta: '\x1b[35m',
}

/**
 * Asks for user confirmation in the CLI.
 */
export function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return new Promise((resolve) => {
    rl.question(`${formatLog(message, colors.yellow)} (y/N): `, (answer) => {
      rl.close()
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes')
    })
  })
}

/**
 * Formats a message with the boltdocs prefix and provided styling.
 */
export function formatLog(message: string, style: string = ''): string {
  return `${style}${colors.bold}[boltdocs]${colors.reset} ${message}${colors.reset}`
}

export function info(message: string) {
  dui.info(message)
}

export function warn(message: string) {
  dui.warn(message)
}

export function error(message: string, error?: any) {
  dui.error(message, error)
}

export function success(message: string) {
  dui.success(message)
}

/**
 * Prints a horizontal divider.
 */
export function divider() {
  dui.dividerLog()
}

/**
 * Prints a boxed title.
 */
export function box(title: string) {
  console.log(dui.single(title, []))
}

export function printDevServerInfo(
  localUrl: string,
  networkUrl: string | null,
): void {
  console.log(dui.devServer(localUrl, networkUrl))
}

export function printPreviewServerInfo(
  localUrl: string,
  networkUrl: string | null,
): void {
  console.log(dui.previewServer(localUrl, networkUrl))
}
