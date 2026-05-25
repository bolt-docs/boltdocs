import readline from 'node:readline'

/**
 * ANSI Escape sequences for terminal coloring and styling.
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
  console.log(formatLog(message))
}

export function warn(message: string) {
  console.log(formatLog(message, colors.yellow))
}

export function error(message: string, error?: any) {
  console.error(formatLog(message, colors.red))
  if (error) console.error(error)
}

export function success(message: string) {
  console.log(formatLog(message, colors.green))
}

/**
 * Prints a horizontal divider.
 */
export function divider() {
  console.log(colors.gray + '─'.repeat(50) + colors.reset)
}

/**
 * Prints a boxed title.
 */
export function box(title: string) {
  const line = '━'.repeat(title.length + 4)
  console.log(`\n${colors.cyan}┏${line}┓`)
  console.log(`┃  ${colors.bold}${title}${colors.reset}${colors.cyan}  ┃`)
  console.log(`┗${line}┛${colors.reset}\n`)
}

const BOX_W = 54

export function printDevServerInfo(
  localUrl: string,
  networkUrl: string | null,
): void {
  const line = '═'.repeat(BOX_W)
  const titleRaw = 'boltdocs dev server'
  const localRaw = `  ➜  Local:   ${localUrl}`
  const netRaw = networkUrl
    ? `  ➜  Network: ${networkUrl}`
    : '  ➜  Network: use --host to expose'
  const helpRaw = '  press h + enter for help'
  const titlePad = BOX_W - titleRaw.length

  console.log(`\n${colors.cyan}╔${line}╗${colors.reset}`)
  console.log(
    `${colors.cyan}║${colors.reset}${' '.repeat(Math.floor(titlePad / 2))}${colors.bold}${titleRaw}${colors.reset}${' '.repeat(Math.ceil(titlePad / 2))}${colors.cyan}║${colors.reset}`,
  )
  console.log(`${colors.cyan}║${colors.reset}${' '.repeat(BOX_W)}${colors.cyan}║${colors.reset}`)
  console.log(
    `${colors.cyan}║${colors.reset}  ${colors.green}➜${colors.reset}  ${colors.green}Local:${colors.reset}   ${colors.cyan}${localUrl}${colors.reset}${' '.repeat(BOX_W - localRaw.length)}${colors.cyan}║${colors.reset}`,
  )
  if (networkUrl) {
    console.log(
      `${colors.cyan}║${colors.reset}  ${colors.green}➜${colors.reset}  ${colors.green}Network:${colors.reset} ${colors.cyan}${networkUrl}${colors.reset}${' '.repeat(BOX_W - netRaw.length)}${colors.cyan}║${colors.reset}`,
    )
  } else {
    console.log(
      `${colors.cyan}║${colors.reset}  ${colors.green}➜${colors.reset}  ${colors.green}Network:${colors.reset} ${colors.gray}use --host to expose${colors.reset}${' '.repeat(BOX_W - netRaw.length)}${colors.cyan}║${colors.reset}`,
    )
  }
  console.log(`${colors.cyan}║${colors.reset}${' '.repeat(BOX_W)}${colors.cyan}║${colors.reset}`)
  console.log(
    `${colors.cyan}║${colors.reset}  ${colors.dim}press h + enter for help${colors.reset}${' '.repeat(BOX_W - helpRaw.length)}${colors.cyan}║${colors.reset}`,
  )
  console.log(`${colors.cyan}╚${line}╝${colors.reset}\n`)
}

export function printPreviewServerInfo(
  localUrl: string,
  networkUrl: string | null,
): void {
  const line = '═'.repeat(BOX_W)
  const titleRaw = 'boltdocs preview server'
  const localRaw = `  ➜  Local:   ${localUrl}`
  const netRaw = networkUrl
    ? `  ➜  Network: ${networkUrl}`
    : '  ➜  Network: use --host to expose'
  const titlePad = BOX_W - titleRaw.length

  console.log(`\n${colors.cyan}╔${line}╗${colors.reset}`)
  console.log(
    `${colors.cyan}║${colors.reset}${' '.repeat(Math.floor(titlePad / 2))}${colors.bold}${titleRaw}${colors.reset}${' '.repeat(Math.ceil(titlePad / 2))}${colors.cyan}║${colors.reset}`,
  )
  console.log(`${colors.cyan}║${colors.reset}${' '.repeat(BOX_W)}${colors.cyan}║${colors.reset}`)
  console.log(
    `${colors.cyan}║${colors.reset}  ${colors.green}➜${colors.reset}  ${colors.green}Local:${colors.reset}   ${colors.cyan}${localUrl}${colors.reset}${' '.repeat(BOX_W - localRaw.length)}${colors.cyan}║${colors.reset}`,
  )
  if (networkUrl) {
    console.log(
      `${colors.cyan}║${colors.reset}  ${colors.green}➜${colors.reset}  ${colors.green}Network:${colors.reset} ${colors.cyan}${networkUrl}${colors.reset}${' '.repeat(BOX_W - netRaw.length)}${colors.cyan}║${colors.reset}`,
    )
  } else {
    console.log(
      `${colors.cyan}║${colors.reset}  ${colors.green}➜${colors.reset}  ${colors.green}Network:${colors.reset} ${colors.gray}use --host to expose${colors.reset}${' '.repeat(BOX_W - netRaw.length)}${colors.cyan}║${colors.reset}`,
    )
  }
  console.log(`${colors.cyan}╚${line}╝${colors.reset}\n`)
}
