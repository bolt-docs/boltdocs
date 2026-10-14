import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { migrate } from '../../src/node/migrate'
import {
  applyFsPatch,
  disableFsPatch,
  setProjectRoot,
} from '../../src/node/security/fs-patch'

/** A 3.x-shaped project on disk, so the walk and the writes are both real. */
function fixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-migrate-'))
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify(
      {
        name: 'site',
        dependencies: {
          boltdocs: '^3.4.0',
          'react-aria-components': '^1.16.0',
        },
      },
      null,
      2,
    ),
  )
  fs.writeFileSync(
    path.join(root, 'boltdocs.config.ts'),
    [
      "import { defineConfig } from 'boltdocs'",
      "import mermaidPlugin from '@bdocs/plugin-mermaid'",
      '',
      'export default defineConfig({',
      "  siteUrl: 'https://example.com',",
      '  plugins: [',
      '    mermaidPlugin(),',
      '  ],',
      '})',
      '',
    ].join('\n'),
  )
  fs.mkdirSync(path.join(root, 'src'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'src', 'nav.tsx'),
    [
      "import { Menu, MenuItem } from 'react-aria-components'",
      "import { Navbar } from '@bdocs/theme-neutral/components/primitives'",
      '',
      'export function Nav() {',
      '  return <MenuItem onPress={go}>Home</MenuItem>',
      '}',
      '',
    ].join('\n'),
  )
  // A directory that must not be scanned.
  fs.mkdirSync(path.join(root, 'node_modules', 'left-pad'), { recursive: true })
  fs.writeFileSync(
    path.join(root, 'node_modules', 'left-pad', 'index.js'),
    "import x from 'react-aria-components'",
  )
  return root
}

function read(root: string, file: string): string {
  return fs.readFileSync(path.join(root, file), 'utf-8')
}

describe('migrate', () => {
  it('reports every 3.x pattern in a dry run without writing', () => {
    const root = fixture()
    const plan = migrate({ root, apply: false })
    const ids = new Set(plan.findings.map((f) => f.id))

    expect(ids).toContain('deps/react-aria')
    expect(ids).toContain('seo/plugin-missing')
    expect(ids).toContain('react-aria/import')
    expect(ids).toContain('react-aria/on-press')
    expect(ids).toContain('theme/subpath')

    // Nothing may have changed on disk.
    expect(read(root, 'src/nav.tsx')).toContain('react-aria-components')
    expect(read(root, 'package.json')).toContain('react-aria-components')
    expect(plan.applied).toEqual([])
  })

  it('never scans node_modules', () => {
    const root = fixture()
    const plan = migrate({ root, apply: false })
    expect(plan.findings.some((f) => f.file.includes('node_modules'))).toBe(
      false,
    )
  })

  it('applies the fixable changes and leaves the manual ones', () => {
    const root = fixture()
    const plan = migrate({ root, apply: true })

    const nav = read(root, 'src/nav.tsx')
    expect(nav).toContain("from '@bdocs/primitives'")
    expect(nav).toContain("from '@bdocs/theme-neutral/composition'")
    expect(nav).not.toContain('react-aria-components')
    // onPress is reported, never silently renamed.
    expect(nav).toContain('onPress={go}')

    const config = read(root, 'boltdocs.config.ts')
    expect(config).toContain("import seoPlugin from '@bdocs/plugin-seo'")
    expect(config).toContain('seoPlugin()')
    expect(config).toContain('mermaidPlugin()')

    const pkg = JSON.parse(read(root, 'package.json'))
    expect(pkg.dependencies['react-aria-components']).toBeUndefined()
    expect(pkg.dependencies['@bdocs/primitives']).toBeDefined()
    expect(pkg.name).toBe('site')

    expect(plan.applied.length).toBeGreaterThan(0)
  })

  it('is idempotent — a second run finds nothing to change', () => {
    const root = fixture()
    migrate({ root, apply: true })
    const second = migrate({ root, apply: false })

    // The manual onPress finding legitimately persists; everything fixable
    // must be gone, which is what "no more edits" means here.
    const fixable = second.findings.filter((f) => f.action === 'fixable')
    expect(fixable).toEqual([])

    const before = read(root, 'src/nav.tsx')
    migrate({ root, apply: true })
    expect(read(root, 'src/nav.tsx')).toBe(before)
  })

  it('reports nothing for a project already on 4.0', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-migrate-ok-'))
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify(
        { name: 'site', dependencies: { boltdocs: '^4.0.0' } },
        null,
        2,
      ),
    )
    fs.writeFileSync(
      path.join(root, 'src.tsx'),
      "import { Menu } from '@bdocs/primitives'\n",
    )
    expect(migrate({ root, apply: false }).findings).toEqual([])
  })

  it('orders blocking findings first', () => {
    const root = fixture()
    const severities = migrate({ root, apply: false }).findings.map(
      (f) => f.severity,
    )
    const firstInfo = severities.indexOf('info')
    expect(
      firstInfo === -1 ||
        severities.slice(firstInfo).every((s) => s === 'info'),
    ).toBe(true)
  })

  it('applies fixes against the root it was given, not the cwd', () => {
    const root = fixture()

    // The fs guard resolves against a root captured from `process.cwd()` when
    // the patch is installed, and the command re-points it at its own argument.
    // Without that, `boltdocs migrate ./other-site` rejects every write with a
    // security error. Installing the patch here exercises the same path.
    applyFsPatch()
    setProjectRoot(root)
    try {
      const plan = migrate({ root, apply: true })
      expect(
        fs.readFileSync(path.join(root, 'src', 'nav.tsx'), 'utf-8'),
      ).toContain('@bdocs/primitives')
      expect(plan.findings.some((f) => f.id === 'write/failed')).toBe(false)
    } finally {
      disableFsPatch()
    }
  })

  it('reports a write it was refused, with the reason', () => {
    // Built before the patch is installed: `fixture()` writes to disk, and a
    // guard left armed by an earlier test would reject those writes instead of
    // the ones this test is about.
    const root = fixture()

    // Point the guard at an unrelated project so every write inside `root` is
    // refused. The assertion is not that the guard fires — it is that a refused
    // write becomes a report line carrying the reason, rather than a silent
    // no-op that still claims "Applied N fixes".
    applyFsPatch()
    setProjectRoot(path.join(root, 'nested', 'other'))
    try {
      const plan = migrate({ root, apply: true })
      const failures = plan.findings.filter((f) => f.id === 'write/failed')
      expect(failures.length).toBeGreaterThan(0)
      expect(failures[0].detail).toMatch(/Boltdocs Security/)
    } finally {
      disableFsPatch()
    }
  })
})
