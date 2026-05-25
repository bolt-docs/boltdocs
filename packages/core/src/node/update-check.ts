import { createRequire } from 'node:module'
import { colors } from './cli/ui'

const req = createRequire(import.meta.url)

let lastCheck = 0
const CHECK_INTERVAL = 86_400_000

const BOX_WIDTH = 54

export function isNewerVersion(a: string, b: string): boolean {
  const pa = a.split('-')[0].split('.').map(Number)
  const pb = b.split('-')[0].split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0
    const nb = pb[i] ?? 0
    if (Number.isNaN(na) || Number.isNaN(nb)) return false
    if (na !== nb) return na > nb
  }
  return false
}

async function getLatestVersion(): Promise<string | null> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)
    const res = await fetch('https://registry.npmjs.org/boltdocs/latest', {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.npm.install-v1+json' },
    })
    clearTimeout(timeout)
    if (!res.ok) return null
    const data = (await res.json()) as { version?: string }
    return data.version ?? null
  } catch {
    return null
  }
}

export async function getCurrentVersion(): Promise<string> {
  try {
    const pkg = req('boltdocs/package.json') as { version: string }
    return pkg.version
  } catch {
    return '0.0.0'
  }
}

function padCenter(s: string, w: number): string {
  const pad = Math.max(0, w - s.length)
  return ' '.repeat(Math.floor(pad / 2)) + s + ' '.repeat(Math.ceil(pad / 2))
}

function padLeft(s: string, w: number): string {
  return s + ' '.repeat(Math.max(0, w - s.length))
}

export function renderUpdateBox(current: string, latest: string): string {
  const line = '═'.repeat(BOX_WIDTH)
  const lines: string[] = []

  lines.push(`${colors.cyan}╔${line}╗${colors.reset}`)

  const titleRaw = '🚀  Update available!'
  lines.push(
    `${colors.cyan}║${colors.reset}${padCenter(titleRaw, BOX_WIDTH)}${colors.cyan}║${colors.reset}`,
  )

  lines.push(`${colors.cyan}║${colors.reset}${' '.repeat(BOX_WIDTH)}${colors.cyan}║${colors.reset}`)

  const versionRaw = `Current: ${current}  →  ${latest}`
  const versionDisplay = `${colors.dim}Current:${colors.reset} ${colors.red}${current}${colors.reset}  ${colors.gray}→${colors.reset}  ${colors.green}${latest}${colors.reset}`
  lines.push(
    `${colors.cyan}║${colors.reset}  ${versionDisplay}${padLeft('', BOX_WIDTH - 2 - versionRaw.length)}${colors.cyan}║${colors.reset}`,
  )

  lines.push(`${colors.cyan}║${colors.reset}${' '.repeat(BOX_WIDTH)}${colors.cyan}║${colors.reset}`)

  const runRaw = 'Run:  npm install boltdocs@latest'
  const runDisplay = `${colors.dim}Run:${colors.reset}  ${colors.bold}npm install boltdocs@latest${colors.reset}`
  lines.push(
    `${colors.cyan}║${colors.reset}  ${runDisplay}${padLeft('', BOX_WIDTH - 2 - runRaw.length)}${colors.cyan}║${colors.reset}`,
  )

  lines.push(`${colors.cyan}╚${line}╝${colors.reset}`)

  return '\n' + lines.join('\n') + '\n'
}

export async function notifyUpdateAvailable(): Promise<void> {
  const now = Date.now()
  if (now - lastCheck < CHECK_INTERVAL) return
  lastCheck = now

  const current = await getCurrentVersion()
  if (current === '0.0.0') return

  const latest = await getLatestVersion()
  if (!latest) return

  if (!isNewerVersion(latest, current)) return

  console.log(renderUpdateBox(current, latest))
}
