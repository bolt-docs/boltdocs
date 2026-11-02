import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { auditPlugin, auditPlugins } from '../../src/node/security/audit'
import {
  makeProjectCopy,
  cleanupProject,
  markerPaths,
  assertNoMarkers,
} from './test-utils'

let root: string

beforeEach(() => {
  root = makeProjectCopy()
  // sanity: the fixture starts clean
  for (const marker of markerPaths(root)) {
    expect(fs.existsSync(marker)).toBe(false)
  }
})

afterEach(() => {
  cleanupProject(root)
})

describe('audit engine (static-only)', () => {
  it('audits a malicious plugin WITHOUT executing its code', () => {
    const report = auditPlugin('evil-plugin', root)

    // The plugin code (module side-effect, runtime exec, install script)
    // must never have run:
    assertNoMarkers(root)

    expect(report.status).toBe('warning')
    expect(report.severity).toBe('high')
    expect(report.version).toBe('1.0.0')

    const ids = report.findings.map((f) => f.ruleId)
    expect(ids).toEqual(
      expect.arrayContaining([
        'child-process-exec',
        'import-child-process',
        'fetch-call',
        'fs-write',
        'install-script',
      ]),
    )

    // test/evil.test.js must NOT be scanned
    expect(report.findings.some((f) => f.file.includes('test/'))).toBe(false)
    expect(report.filesScanned).toBe(2) // index.js + dist/index.js
  })

  it('reports a clean plugin with no findings', () => {
    const report = auditPlugin('clean-plugin', root)
    expect(report.status).toBe('clean')
    expect(report.findings).toEqual([])
    expect(report.filesScanned).toBe(1)
  })

  it('flags obfuscation + metadata issues in the sneaky plugin', () => {
    const report = auditPlugin('sneaky-plugin', root)
    expect(report.severity).toBe('high')
    const ids = report.findings.map((f) => f.ruleId)
    expect(ids).toEqual(
      expect.arrayContaining(['eval-call', 'atob-btoa', 'remote-deps']),
    )
  })

  it('reports unresolved plugins when the package is not installed', () => {
    const report = auditPlugin('missing-plugin', root)
    expect(report.status).toBe('unresolved')
    expect(report.findings).toEqual([])
  })

  it('audits every configured plugin in order', () => {
    const reports = auditPlugins(
      [
        { name: 'clean-plugin' },
        { name: 'evil-plugin' },
        { name: 'missing-plugin' },
      ],
      root,
    )
    expect(reports.map((r) => r.name)).toEqual([
      'clean-plugin',
      'evil-plugin',
      'missing-plugin',
    ])
    assertNoMarkers(root)
  })

  it('resolves plugin dirs as real directories', () => {
    const report = auditPlugin('evil-plugin', root)
    expect(report.pluginDir).toBe(
      path.join(root, 'node_modules', 'evil-plugin'),
    )
  })
})
