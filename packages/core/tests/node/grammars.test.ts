import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(HERE, '../../src/node/mdx')
const GRAMMARS = join(SRC, 'grammars')
const LANGS_MODULE = join(SRC, 'shiki-langs.ts')

const RELATIVE_IMPORT = /(?:from|import)\s*\(?\s*['"]\.\/([^'"]+\.mjs)['"]/g

function grammarFiles(): string[] {
  return readdirSync(GRAMMARS).filter((f) => f.endsWith('.mjs'))
}

/**
 * The vendored grammars are a closure, not a flat list: several of them import
 * siblings that are not themselves reachable languages. These tests exist because
 * a partial copy fails at build time with an opaque `UNRESOLVED_IMPORT` from
 * rolldown rather than pointing at the grammar that lost its dependency.
 */
describe('vendored shiki grammars', () => {
  it('resolves every relative import inside every vendored grammar', () => {
    const missing: string[] = []

    for (const file of grammarFiles()) {
      const source = readFileSync(join(GRAMMARS, file), 'utf8')
      for (const [, dep] of source.matchAll(RELATIVE_IMPORT)) {
        if (!existsSync(join(GRAMMARS, dep))) {
          missing.push(`${file} imports ./${dep}`)
        }
      }
    }

    expect(missing).toEqual([])
  })

  it('does not import @shikijs/langs from the highlighter path', () => {
    const source = readFileSync(LANGS_MODULE, 'utf8')

    expect(source).not.toMatch(/^\s*import\s.*@shikijs\/langs/m)
  })

  it('backs every declared language with a vendored grammar', () => {
    const source = readFileSync(LANGS_MODULE, 'utf8')
    const declared = [
      ...source.matchAll(
        /^import\s+\w+\s+from\s+'\.\/grammars\/([^']+)\.mjs'/gm,
      ),
      ...source.matchAll(
        /^\s+\w+:\s+\(\)\s*=>\s*import\('\.\/grammars\/([^']+)\.mjs'\)/gm,
      ),
    ].map(([, name]) => name)

    const missing = declared.filter(
      (name) => !existsSync(join(GRAMMARS, `${name}.mjs`)),
    )

    expect(missing).toEqual([])
    // Guards the test itself: if the regexes stop matching, an empty `declared`
    // would pass vacuously and stop protecting anything.
    expect(declared.length).toBeGreaterThan(30)
  })

  it('keeps the vendored set far smaller than the package it replaces', () => {
    // 39 reachable languages plus their siblings, against 347 grammars upstream.
    // A regression that reintroduces the full set would show up as a large jump.
    expect(grammarFiles().length).toBeLessThan(70)
  })
})
