import { createRequire } from 'node:module'
import * as dui from '@bdocs/dui'

const req = createRequire(import.meta.url)

let lastCheck = 0
const CHECK_INTERVAL = 86_400_000

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

export function renderUpdateBox(current: string, latest: string): string {
  return dui.updateAvailable(current, latest)
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

  console.log(dui.updateAvailable(current, latest))
}
