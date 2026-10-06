import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The theme is moving from Tailwind utility classes to plain CSS.
 *
 * A handful of components are converted; the rest are not yet. This file is what
 * keeps that a direction rather than a wish — a converted component that grows a
 * utility class again fails here instead of quietly reintroducing a dependency on
 * a Tailwind build the theme is supposed not to need.
 *
 * The list is explicit for the same reason a converted list is usually explicit:
 * globbing would pass on day one and mean nothing, because every file still has
 * classes in it.
 */

const SRC = join(__dirname, '..', 'src')

/**
 * Converted so far, with the stylesheet that now carries their styling.
 *
 * Both layers are listed. The primitives were the reason the theme still needed
 * Tailwind at all: a primitive that emits `flex items-center gap-4` is not
 * style-neutral however carefully the theme layer above it is written.
 */
const CONVERTED: Record<string, string> = {
  'components/primitives/page-nav.tsx': 'page-nav.css',
  'components/primitives/docs-layout.tsx': 'docs-layout.css',
  'components/primitives/breadcrumbs.tsx': 'breadcrumbs.css',
  'components/ui-base/page-nav.tsx': 'page-nav.css',
  'components/ui-base/breadcrumbs.tsx': 'breadcrumbs.css',
  'components/docs-layout-default.tsx': 'docs-layout.css',
  'components/primitives/button-group.tsx': 'button-group.css',
  'components/primitives/callout.tsx': 'callout.css',
  'components/primitives/error-boundary.tsx': 'error-boundary.css',
  'components/primitives/heading.tsx': 'heading.css',
  'components/primitives/image.tsx': 'image.css',
  'components/primitives/menu.tsx': 'menu.css',
  'components/primitives/popover.tsx': 'popover.css',
  'components/primitives/skeleton.tsx': 'skeleton.css',
  'components/primitives/tabs.tsx': 'tabs.css',
  'components/primitives/tooltip.tsx': 'tooltip.css',
  'components/mdx/callout.tsx': 'callout.css',
}

/**
 * Classes allowed to survive in a converted file, each with its reason. Anything
 * added here needs a reason that survives the question "why is this not in the
 * stylesheet?", so an empty entry is not an option.
 */
const ALLOWED = new Map<string, string>([
  [
    'prose',
    'Tailwind Typography plugin. It styles the MDX content wrapper by parsing the\n     * rendered HTML with its own cascade, so it cannot be expressed as a rule\n     * against our own classes. It is a site dependency, not a theme style —\n     * `max-w-none` alongside it stops it imposing a measure on the reading\n     * column, which the theme sets.',
  ],
  ['prose-neutral', 'Tailwind Typography neutral palette, with `prose` above.'],
  [
    'dark:prose-invert',
    'Tailwind Typography inverted palette, with `prose` above.',
  ],
  [
    'max-w-none',
    'Overrides the measure Typography imposes, because\n     * `--bdocs-content-max` owns the reading column width.',
  ],
])

/**
 * Tailwind utilities that are a single bare word.
 *
 * Every other utility carries punctuation, which is what the shape test keys on.
 */
const BARE = new Set([
  'flex',
  'grid',
  'block',
  'inline',
  'contents',
  'hidden',
  'table',
  'isolate',
  'truncate',
  'antialiased',
  'italic',
  'underline',
  'uppercase',
  'lowercase',
  'capitalize',
  'fixed',
  'absolute',
  'relative',
  'sticky',
  'static',
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

/**
 * Everything that reaches a `class`/`className` attribute.
 *
 * Collects the attribute *value expression* rather than the literal string, so a
 * utility written as `cn('flex', className)` is caught the same as
 * `className="flex"`. Scanning only double-quoted values missed the `cn(` form
 * entirely, which is the form this codebase prefers — the guard reported clean
 * files that were full of utilities.
 */
function classExpressions(source: string): string[] {
  const out: string[] = []
  // A quoted value, or a brace-delimited expression. The expression form is
  // matched non-greedily up to the matching brace rather than to the first `}`,
  // because `cn('flex', className)` has to arrive whole for the literals inside
  // it to be visible to the scan.
  const attr =
    /\b(?:className|class)\s*=\s*(?:"([^"]*)"|\{((?:[^{}]|\{[^{}]*\})*)\})/g
  for (const m of source.matchAll(attr)) {
    const raw = m[1] ?? m[2] ?? ''
    if (raw.trim()) out.push(raw)
  }
  return out
}

/** Unrecognised class tokens in a source file, minus the allowed ones. */
function utilitiesIn(source: string): string[] {
  const found = new Set<string>()
  for (const expr of classExpressions(source)) {
    // String literals only. Identifiers inside the expression (`className`,
    // `cn`, commas) are JavaScript, not classes, and flagging them would train
    // the guard to be ignored.
    for (const literal of expr.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)) {
      const raw = (literal[1] ?? literal[2] ?? literal[3] ?? '')
        // Drop interpolations before tokenising. `${card}` is a variable, not a
        // utility.
        .replace(/\$\{[^}]*\}/g, ' ')
      for (const token of raw.split(/[\s'"`]+/)) {
        const t = token.trim()
        if (!t) continue
        // Our own class names, plus any `data-`/`aria-` attributes that happen to
        // share the syntax.
        if (/^(bdocs-|boltdocs-)/.test(t)) continue
        if (ALLOWED.has(t)) continue
        // Only tokens shaped like a utility.
        //
        // A `cn(...)` call is JavaScript as much as it is a class list, and its
        // arguments include enum comparisons - `anchorPosition === 'wrap'` - whose
        // literals sit in the same place as classes. Flagging those trains the
        // guard to be ignored, which is worse than missing a token. A utility has
        // punctuation in it, or is one of the few Tailwind words spelled bare.
        if (!/[-:/[\]]/.test(t) && !BARE.has(t)) continue
        found.add(t)
      }
    }
  }
  return [...found]
}

const componentStyles = () => {
  const dir = join(SRC, 'styles/components')
  return existsSync(dir)
    ? readdirSync(dir).filter((f) => f.endsWith('.css'))
    : []
}

describe('theme-neutral styles', () => {
  it('ships a stylesheet that resolves without Tailwind', () => {
    const index = readFileSync(join(SRC, 'styles/index.css'), 'utf-8')
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

  it('declares every token the stylesheets consume', () => {
    const tokens = readFileSync(join(SRC, 'styles/tokens.css'), 'utf-8')
    expect(tokens).toMatch(/^:root \{/m)

    // Read off the stylesheets rather than pinned in the test: a hand-kept list
    // needs editing on every token change and then only proves it matches
    // itself. What must hold is that the theme never reaches for a token that
    // does not exist — that resolves to nothing at runtime and renders unstyled
    // with no error anywhere.
    // Both layers. A private token that does not exist makes its declaration
    // invalid at computed-value time, which does not error — the property simply
    // falls back to `unset` and inherits. That is how a caption ended up wearing
    // the body colour: `--_bdocs-ink-faint` was used by a component and only the
    // public `--bdocs-ink-faint` was ever defined. The earlier version of this
    // guard matched `--bdocs-` only, so it could not have caught it.
    const consumed = new Set<string>()
    for (const file of [...componentStyles(), '../base.css']) {
      const css = readFileSync(join(SRC, 'styles/components', file), 'utf-8')
      for (const m of css.matchAll(/var\(\s*(--_?bdocs-[a-z0-9-]+)/g))
        consumed.add(m[1])
    }
    const declared = new Set([
      ...[...tokens.matchAll(/^\s*(--_?bdocs-[a-z0-9-]+)\s*:/gm)].map(
        (m) => m[1],
      ),
      // `color: var(--x)` where `--x` has a fallback never reaches this check
      // meaningfully, so fallbacks are stripped first: a declaration carrying a
      // fallback is one the author knew might be missing, and one without is the
      // dangerous kind.
    ])
    expect([...consumed].filter((t) => !declared.has(t)).sort()).toEqual([])
    // Sanity, so an empty scan cannot pass by having found nothing.
    expect(consumed.size).toBeGreaterThan(10)
  })

  it('keeps converted components free of utility classes', () => {
    const offenders: Record<string, string[]> = {}
    for (const rel of Object.keys(CONVERTED)) {
      const found = utilitiesIn(readFileSync(join(SRC, rel), 'utf-8'))
      if (found.length > 0) offenders[rel] = found
    }
    expect(offenders).toEqual({})
  })

  it('gives every allowed exception a written reason', () => {
    // An exception with a blank reason is indistinguishable from a leftover.
    const empty = [...ALLOWED.entries()]
      .filter(([, why]) => !why.trim())
      .map(([k]) => k)
    expect(empty).toEqual([])
  })

  it('has the stylesheet each converted component claims', () => {
    const missing = Object.entries(CONVERTED)
      .filter(([, css]) => !existsSync(join(SRC, 'styles/components', css)))
      .map(([tsx]) => tsx)
    expect(missing).toEqual([])
  })

  it('imports every component stylesheet from the entry', () => {
    // A stylesheet nothing imports is inert — which is how `base.css` and the
    // old `neutral.css` each managed to ship while styling nothing.
    const index = readFileSync(join(SRC, 'styles/index.css'), 'utf-8')
    const referenced = new Set(
      [...index.matchAll(/@import\s+["'](.+?)["']/g)].map((m) =>
        m[1].replace(/^\.\//, ''),
      ),
    )
    const orphaned = componentStyles()
      .map((f) => `components/${f}`)
      .filter((f) => !referenced.has(f))
      .sort()
    expect(orphaned).toEqual([])
  })

  it('scopes the base sheet to a root class something renders', () => {
    // `.bdocs-root` was invented by the stylesheet and then never rendered, so
    // the entire base layer matched nothing. The class has to appear in a
    // primitive, not only in a comment.
    expect(
      readFileSync(join(SRC, 'components/primitives/docs-layout.tsx'), 'utf-8'),
    ).toContain('bdocs-root')
  })

  it('imposes no global element styles outside the root scope', () => {
    // A theme that styles `body` or `html` directly cannot be embedded in a host
    // page. Every element rule has to sit under `.bdocs-root`.
    const offenders: Record<string, number[]> = {}
    for (const file of ['base.css', ...componentStyles()]) {
      const path = file === 'base.css' ? 'base.css' : `components/${file}`
      const hits = readFileSync(join(SRC, 'styles', path), 'utf-8')
        .split('\n')
        .map((line, i) => [i + 1, line] as const)
        .filter(([, line]) => /^\s*(html|body)\b\s*[,{]/.test(line))
        .map(([n]) => n)
      if (hits.length > 0) offenders[path] = hits
    }
    expect(offenders).toEqual({})
  })

  it('writes no raw colour in a component stylesheet', () => {
    // A literal hex in a component rule is a token that failed to be created.
    // Allowed: `transparent`, `currentColor`, and `rgb(... / 0)` as a way of
    // saying "no colour", because none of those is a brand decision.
    const raw = /#[0-9a-f]{3,8}\b|rgba?\(\s*\d/i
    // Line numbers, so a failure names the line to look at instead of making
    // the reader diff two stylesheets to find a hex.
    const offenders: Record<string, number[]> = {}
    for (const file of componentStyles()) {
      // Comments are documentation, not declarations. A stylesheet explaining
      // the measured value it replaced — `rgba(0, 0, 0, 0)` — is exactly where a
      // colour most deserves to be written down.
      const source = readFileSync(join(SRC, 'styles/components', file), 'utf-8')
      const hits: number[] = []
      let inComment = false
      source.split('\n').forEach((line, i) => {
        let text = line
        if (inComment) {
          const end = text.indexOf('*/')
          if (end === -1) return
          text = text.slice(end + 2)
          inComment = false
        }
        const open = text.lastIndexOf('/*')
        if (open !== -1 && text.indexOf('*/', open) === -1) {
          text = text.slice(0, open)
          inComment = true
        }
        if (raw.test(text)) hits.push(i + 1)
      })
      if (hits.length > 0) offenders[file] = hits
    }
    expect(offenders).toEqual({})
  })
})

describe('conversion progress', () => {
  it('reports how much of the theme is still on utilities', () => {
    const files = walk(SRC).filter((f) => f.endsWith('.tsx'))
    const converted = new Set(Object.keys(CONVERTED))
    const withUtilities = files
      .filter((f) => !converted.has(relative(SRC, f).replaceAll('\\', '/')))
      .filter((f) => utilitiesIn(readFileSync(f, 'utf-8')).length > 0)
    // Not an assertion about a number — it would need editing on every
    // conversion and would only ever be satisfied by deleting the file. It
    // prints, so the remaining work is visible instead of assumed finished.
    console.log(
      `  theme-neutral: ${CONVERTED_OBJECT_SIZE} convertidos, ${withUtilities.length} de ${files.length} ficheros siguen con utilidades`,
    )
    expect(withUtilities.length).toBeLessThan(files.length)
  })
})

const CONVERTED_OBJECT_SIZE = Object.keys(CONVERTED).length
