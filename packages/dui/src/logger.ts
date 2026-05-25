import { colors } from './colors'

const PREFIX = `${colors.bold}[boltdocs]${colors.reset}`

function log(stream: 'stdout' | 'stderr', color: ((s: string) => string) | null, msg: string, extra?: unknown): void {
  const prefix = color ? `${color(PREFIX)}` : PREFIX
  const out = stream === 'stderr' ? console.error : console.log
  out(`${prefix} ${msg}`)
  if (extra !== undefined) {
    out(extra)
  }
}

export function info(msg: string): void {
  log('stdout', null, msg)
}

export function warn(msg: string): void {
  log('stdout', colors.yellow, msg)
}

export function error(msg: string, err?: unknown): void {
  log('stderr', colors.red, msg, err)
}

export function success(msg: string): void {
  log('stdout', colors.green, msg)
}

export function debug(msg: string): void {
  if (process.env.DEBUG || process.env.BOLTDOCS_DEBUG) {
    log('stdout', colors.dim, msg)
  }
}
