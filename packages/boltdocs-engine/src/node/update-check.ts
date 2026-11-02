import { createRequire } from 'node:module'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { updateAvailable } from './ui-utils'

const req = createRequire(import.meta.url)

const CHECK_INTERVAL = 86_400_000 // 24 hours

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
    // 1. Try to find package.json relative to the current module file location
    const currentFile = fileURLToPath(import.meta.url)
    let dir = path.dirname(currentFile)
    for (let i = 0; i < 5; i++) {
      const pkgPath = path.join(dir, 'package.json')
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
        if (pkg.name === 'boltdocs') {
          return pkg.version
        }
      }
      dir = path.dirname(dir)
    }
  } catch {}

  try {
    const pkg = req('boltdocs/package.json') as { version: string }
    return pkg.version
  } catch {
    return '0.0.0'
  }
}

export function renderUpdateBox(current: string, latest: string): string {
  return updateAvailable(current, latest)
}

export async function notifyUpdateAvailable(): Promise<void> {
  let cacheFile = ''
  try {
    cacheFile = path.join(os.homedir(), '.boltdocs', 'update-check.json')
  } catch {
    // homedir might fail in some environments
    return
  }

  let lastCheck = 0
  try {
    if (fs.existsSync(cacheFile)) {
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'))
      lastCheck = Number(cache.lastCheck) || 0
    }
  } catch {}

  const now = Date.now()
  if (now - lastCheck < CHECK_INTERVAL) return

  // Update check timestamp immediately so concurrent/subsequent runs don't stack network requests
  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true })
    fs.writeFileSync(cacheFile, JSON.stringify({ lastCheck: now }), 'utf-8')
  } catch {}

  const current = await getCurrentVersion()
  if (current === '0.0.0') return

  const latest = await getLatestVersion()
  if (!latest) return

  if (!isNewerVersion(latest, current)) return

  console.log(updateAvailable(current, latest))
}
