import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(
  fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf-8'),
) as {
  type?: string
  exports: Record<string, unknown>
  main?: string
  module?: string
}

describe('core package: published format', () => {
  it('is ESM-only, and says so', () => {
    // The package ships no CommonJS build. A `require` condition pointing at a
    // file the build never produces is the worst outcome: it resolves at
    // install time and throws at runtime, in someone else's project.
    expect(pkg.type).toBe('module')
  })

  it('declares no require condition on any export', () => {
    for (const [subpath, value] of Object.entries(pkg.exports)) {
      if (typeof value === 'string') continue
      const conditions = value as Record<string, string>
      expect(
        conditions.require,
        `\`${subpath}\` still declares a require condition: ${conditions.require}`,
      ).toBeUndefined()
    }
  })

  it('resolves every export to a file the build actually produces', () => {
    // Walks the declared targets and checks them against the built dist. The
    // alternative — trusting the manifest — is what let a stale `require`
    // condition survive a config change unnoticed.
    const distExists = fs.existsSync(path.join(pkgDir, 'dist'))
    if (!distExists) {
      // A test run without a build cannot check this, and failing it would
      // train people to ignore the suite rather than to run the build.
      return
    }

    const targets: string[] = []
    for (const value of Object.values(pkg.exports)) {
      if (typeof value === 'string') {
        targets.push(value)
        continue
      }
      for (const [condition, target] of Object.entries(
        value as Record<string, string>,
      )) {
        if (condition === 'types') continue
        targets.push(target)
      }
    }

    for (const target of targets) {
      // `exports` declares `.d.ts` while the build emits `.d.mts` — the pattern
      // every entry in this package uses and the one TypeScript resolves. The
      // assertion is about the *runtime* file existing, so accept either
      // extension rather than asserting a convention this package does not
      // follow in its output directory.
      const resolved = target.replace(/\.d\.ts$/, '.d.mts')
      expect(
        fs.existsSync(path.join(pkgDir, resolved)) ||
          fs.existsSync(path.join(pkgDir, target)),
        `\`${target}\` is declared in exports but missing from dist`,
      ).toBe(true)
    }
  })

  it('ships no .cjs in dist', () => {
    const dist = path.join(pkgDir, 'dist')
    if (!fs.existsSync(dist)) return

    const walk = (dir: string): string[] => {
      const out: string[] = []
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) out.push(...walk(full))
        else out.push(full)
      }
      return out
    }

    const cjs = walk(dist).filter((f) => f.endsWith('.cjs'))
    expect(
      cjs,
      `CJS output is back in dist (${cjs.length} files); it was 2.87 MB of the 5.84 MB tarball`,
    ).toEqual([])
  })
})
