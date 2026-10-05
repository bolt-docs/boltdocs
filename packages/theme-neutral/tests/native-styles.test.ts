import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The theme is moving from Tailwind utility classes to plain CSS.
 *
 * `page-nav.tsx` is converted; the rest of the components are not yet. This file
 * is what keeps that a direction rather than a wish — a converted component that
 * grows a utility class again fails here instead of quietly reintroducing a
 * dependency on a Tailwind build the theme is supposed not to need.
 *
 * The list is explicit for the same reason a converted list is usually explicit:
 * globbing would pass on day one and mean nothing, because every file still has
 * classes in it.
 */

const SRC = join(__dirname, '..', 'src')

/** Converted so far. Add a path here once its component stylesheet exists. */
const CONVERTED = ['components/ui-base/page-nav.tsx']

/**
 * Utilities that survive in a converted file legitimately, because they express
 * something the stylesheet cannot: a caller-supplied passthrough and the
 * primitives' own state attributes.
 */
const ALLOWED = new Set([
  // used by the `className` passthrough pattern itself
  'group',
])

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.tsx?$/.test(full)) out.push(full)
  }
  return out
}

/** Every Tailwind-ish token in a `className` string, minus the allowed ones. */
function utilitiesIn(source: string): string[] {
  const found = new Set<string>()
  const classAttr =
    /(?:className|class)\s*=\s*(?:"([^"]*)"|\{`([^`]*)`\}|\{cn\(([\s\S]*?)\)\})/g
  for (const match of source.matchAll(classAttr)) {
    const raw = match[1] ?? match[2] ?? match[3] ?? ''
    // Drop interpolations before tokenising. `${card}` is a variable, not a
    // utility, and flagging it would train the guard to be ignored.
    const literal = raw.replace(/\$\{[^}]*\}/g, ' ')
    for (const token of literal.split(/[\s'"`]+/)) {
      const t = token.trim()
      if (!t) continue
      if (t.startsWith('bdocs-')) continue
      if (ALLOWED.has(t)) continue
      found.add(t)
    }
  }
  return [...found]
}

describe('theme-neutral styles', () => {
  it('ships a stylesheet that resolves without Tailwind', () => {
    const index = readFileSync(join(SRC, 'styles/index.css'), 'utf-8')
    // A `@theme` block only exists inside Tailwind's build. Reading these files
    // without Tailwind is the whole point of "native CSS", and it is what the
    // previous neutral.css got wrong: it was a Tailwind file that nothing loaded.
    // Quote-agnostic on purpose. Biome rewrites the CSS to double quotes, and a
    // guard that fails when a file is formatted is a guard that gets deleted.
    expect(index).not.toMatch(/^\s*@theme\b/m)
    expect(index).toMatch(/@import\s+["']\.\/tokens\.css["']/)

    // Every file in the tree, not just the entry. A `@theme` in a component
    // stylesheet is the same regression as one in the entry, and it would be
    // invisible to a check that only reads the entry.
    const offenders = walk(join(SRC, 'styles'))
      .filter((f) => f.endsWith('.css'))
      .filter((f) => /^\s*@theme\b/m.test(readFileSync(f, 'utf-8')))
      .map((f) => relative(SRC, f).replaceAll('\\', '/'))
    expect(offenders).toEqual([])
  })

  it('declares its public tokens as plain custom properties', () => {
    const tokens = readFileSync(join(SRC, 'styles/tokens.css'), 'utf-8')
    expect(tokens).toMatch(/^:root \{/m)
    for (const token of [
      '--bdocs-bg',
      '--bdocs-text',
      '--bdocs-primary',
      '--bdocs-radius',
      '--bdocs-font-family',
    ]) {
      expect(tokens).toContain(`${token}:`)
    }
  })

  it('keeps converted components free of utility classes', () => {
    for (const rel of CONVERTED) {
      const source = readFileSync(join(SRC, rel), 'utf-8')
      expect({ file: rel, utilities: utilitiesIn(source) }).toEqual({
        file: rel,
        utilities: [],
      })
    }
  })

  it('has a stylesheet for every converted component', () => {
    for (const rel of CONVERTED) {
      const name = rel
        .split('/')
        .pop()
        ?.replace(/\.tsx?$/, '')
      const css = join(SRC, 'styles/components', `${name}.css`)
      expect({
        file: css,
        exists: Boolean(readFileSync(css, 'utf-8')),
      }).toEqual({ file: css, exists: true })
    }
  })

  it('imposes no global element styles outside the root scope', () => {
    // A theme that styles `body` or `html` directly cannot be embedded in a host
    // page. Every element rule has to sit under `.bdocs-root`.
    const base = readFileSync(join(SRC, 'styles/base.css'), 'utf-8')
    const offenders = base
      .split('\n')
      .map((line, i) => [i + 1, line] as const)
      .filter(([, line]) => /^\s*(html|body)\b\s*[,{]/.test(line))
      .map(([n]) => n)
    expect(offenders).toEqual([])
  })
})

describe('conversion progress', () => {
  it('reports how much of the theme is still on utilities', () => {
    const files = walk(SRC).filter((f) => f.endsWith('.tsx'))
    const withUtilities = files.filter(
      (f) => utilitiesIn(readFileSync(f, 'utf-8')).length > 0,
    )
    const done = files.filter((f) =>
      CONVERTED.includes(relative(SRC, f).replaceAll('\\', '/')),
    )
    // Not an assertion about a number — it would need editing on every conversion
    // and would only ever be satisfied by deleting the file. It prints, so the
    // remaining work is visible instead of assumed to be finished.
    console.log(
      `  theme-neutral: ${done.length} converted, ${withUtilities.length} of ${files.length} files still on utility classes`,
    )
    expect(CONVERTED.length).toBeLessThanOrEqual(files.length)
  })
})
