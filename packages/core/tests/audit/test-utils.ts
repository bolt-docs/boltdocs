import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export const FIXTURE_PROJECT = path.resolve(HERE, 'fixtures', 'project')

/** Copies the fixture project to a fresh temp dir (hermetic per test). */
export function makeProjectCopy(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-audit-'))
  fs.cpSync(FIXTURE_PROJECT, tmp, { recursive: true })
  return tmp
}

export function cleanupProject(tmp: string): void {
  fs.rmSync(tmp, { recursive: true, force: true })
}

/**
 * Marker files that a *broken* audit would create by executing plugin code:
 * - module-level side effect (index.js writes .marker-imported on import)
 * - runtime code (dist/index.js writes MARKER-exec)
 * - install script (postinstall writes .marker-postinstall)
 */
export function markerPaths(root: string): string[] {
  const pluginDir = path.join(root, 'node_modules', 'evil-plugin')
  return [
    path.join(pluginDir, '.marker-imported'),
    path.join(pluginDir, 'MARKER-exec'),
    path.join(pluginDir, '.marker-postinstall'),
  ]
}

export function assertNoMarkers(root: string): void {
  for (const marker of markerPaths(root)) {
    expect(fs.existsSync(marker)).toBe(false)
  }
}

/** Creates a throwaway package dir with the given relative files. */
export function makePlugin(files: Record<string, string>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-scan-'))
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(dir, rel)
    fs.mkdirSync(path.dirname(abs), { recursive: true })
    fs.writeFileSync(abs, content)
  }
  return dir
}

export function cleanupPlugin(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true })
}
