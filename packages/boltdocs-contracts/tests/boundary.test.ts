import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * Boundary tests for `@bdocs/contracts`.
 *
 * The package exists so that the Node engine, the browser runtime, and the SSG
 * pipeline can be separated without depending on each other. That only holds if
 * the contract layer stays free of every one of them. A single stray `import
 * type { ViteDevServer } from 'vite'` would be type-only, would compile, would
 * ship nothing at runtime — and would quietly weld the contract layer to the
 * toolchain the separation is meant to break.
 *
 * These tests fail on that import rather than leaving it to review.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '../src')

/** Every source file in the package. */
const sourceFiles = (): string[] =>
  readdirSync(SRC)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .map((f) => join(SRC, f))

/** Bare module specifiers imported by a file, excluding relative ones. */
const externalImports = (code: string): string[] => {
  const specifiers: string[] = []
  const patterns = [
    // import ... from 'x'   /  import 'x'
    /\bfrom\s+['"]([^'"]+)['"]/g,
    // bare import 'x' (side-effect import)
    /^\s*import\s+['"]([^'"]+)['"]/gm,
    // import type { X } from 'x'
    /\bimport\s+type\s+[^;]*?\bfrom\s+['"]([^'"]+)['"]/g,
    // require('x')
    /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
    // dynamic import('x')
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ]
  for (const re of patterns) {
    for (const match of code.matchAll(re)) {
      const spec = match[1]
      if (!spec.startsWith('.')) specifiers.push(spec)
    }
  }
  return [...new Set(specifiers)]
}

/**
 * Module prefixes that would tie the contract layer to a runtime.
 *
 * Node builtins are listed by bare name (`fs`) and by prefix (`node:fs`).
 */
const FORBIDDEN: Array<{ label: string; matches: (spec: string) => boolean }> =
  [
    {
      label: 'Node.js builtins',
      matches: (s) =>
        s.startsWith('node:') ||
        /^(fs|path|url|os|crypto|child_process|worker_threads|module)$/.test(s),
    },
    {
      label: 'React',
      matches: (s) =>
        s === 'react' || s.startsWith('react/') || s === 'react-dom',
    },
    { label: 'Vite', matches: (s) => s === 'vite' || s.startsWith('vite/') },
    {
      label: 'bundlers and build tools',
      matches: (s) =>
        /^(rolldown|rollup|esbuild|tsdown|turbo|unbuild)$/.test(s) ||
        s.startsWith('rolldown') ||
        s.startsWith('rollup'),
    },
    {
      label: 'worker pools',
      matches: (s) => s === 'piscina' || s.startsWith('piscina'),
    },
    {
      label: 'image processing',
      matches: (s) => s === 'sharp' || s.startsWith('sharp'),
    },
    {
      label: 'HTML sanitizers',
      matches: (s) => s === 'dompurify' || s === 'isomorphic-dompurify',
    },
    {
      label: 'optional integrations',
      matches: (s) =>
        /@bdocs\/plugin-/.test(s) ||
        /^(mermaid|katex|shiki|flexsearch)$/.test(s),
    },
    { label: 'other @bdocs packages', matches: (s) => s.startsWith('@bdocs/') },
  ]

describe('@bdocs/contracts boundary', () => {
  it('has source files to check', () => {
    // Guards against the other tests passing because the glob matched nothing.
    expect(sourceFiles().length).toBeGreaterThan(0)
  })

  it.each(
    FORBIDDEN.map((f) => [f.label, f] as const),
  )('imports no %s', (_label, rule) => {
    const offenders: string[] = []
    for (const file of sourceFiles()) {
      for (const spec of externalImports(readFileSync(file, 'utf8'))) {
        if (rule.matches(spec)) {
          offenders.push(`${file.split('/').pop()} imports "${spec}"`)
        }
      }
    }
    expect(offenders, `contracts must not depend on ${_label}`).toEqual([])
  })

  it('imports nothing outside the package', () => {
    // The blanket check. The rules above name the offenders; this one catches a
    // dependency nobody thought to list.
    const offenders: string[] = []
    for (const file of sourceFiles()) {
      const specs = externalImports(readFileSync(file, 'utf8'))
      if (specs.length > 0) {
        offenders.push(`${file.split('/').pop()}: ${specs.join(', ')}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('declares no runtime dependencies at all', () => {
    const pkg = JSON.parse(
      readFileSync(resolve(HERE, '../package.json'), 'utf8'),
    )
    // The contract layer is types plus a few constants, so it must not ship any
    // dependency. `peerDependencies` is included in the check on purpose: a peer
    // would still make consumers resolve a runtime package from here.
    expect(pkg.dependencies ?? {}).toEqual({})
    expect(pkg.peerDependencies ?? {}).toEqual({})
  })
})
