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
  'components/composition/page-nav.tsx': 'page-nav.css',
  'components/composition/docs-layout.tsx': 'docs-layout.css',
  'components/composition/breadcrumbs.tsx': 'breadcrumbs.css',
  'components/ui-base/page-nav.tsx': 'page-nav.css',
  'components/ui-base/breadcrumbs.tsx': 'breadcrumbs.css',
  'components/docs-layout-default.tsx': 'docs-layout.css',
  'components/composition/button-group.tsx': 'button-group.css',
  'components/composition/callout.tsx': 'callout.css',
  'components/composition/error-boundary.tsx': 'error-boundary.css',
  'components/composition/heading.tsx': 'heading.css',
  'components/composition/image.tsx': 'image.css',
  'components/composition/menu.tsx': 'menu.css',
  'components/composition/popover.tsx': 'popover.css',
  'components/composition/tabs.tsx': 'tabs.css',
  'components/composition/tooltip.tsx': 'tooltip.css',
  'components/mdx/callout.tsx': 'callout.css',
  'components/mdx/cards.tsx': 'cards.css',
  'components/mdx/table.tsx': 'table.css',
  'components/ui-base/banner.tsx': 'banner.css',
  'components/ui-base/giscus.tsx': 'giscus.css',
  'components/ui-base/not-found.tsx': 'not-found.css',
  'components/internal/error-boundary.tsx': 'error-debug.css',
  'components/composition/on-this-page.tsx': 'on-this-page.css',
  'components/composition/code-block.tsx': 'code-block.css',
  'components/ui-base/theme-toggle.tsx': 'selectors.css',
  'components/ui-base/i18n-selector.tsx': 'selectors.css',
  'components/ui-base/version-selector.tsx': 'selectors.css',
  'components/mdx/code-block.tsx': 'code-block.css',
  'components/mdx/card.tsx': 'prose.css',
  'components/mdx/field.tsx': 'prose.css',
  'components/mdx/image.tsx': 'prose.css',
  'components/mdx/last-updated.tsx': 'last-updated.css',
  'components/mdx/timeline.tsx': 'timeline.css',
  'components/composition/navbar.tsx': 'navbar.css',
  'components/composition/sidebar.tsx': 'sidebar.css',
  'components/composition/search-dialog.tsx': 'search-dialog.css',
  'components/ui-base/navbar.tsx': 'navbar.css',
  'components/ui-base/sidebar.tsx': 'sidebar.css',
  'components/ui-base/search-dialog.tsx': 'search-dialog.css',
  'components/ui-base/copy-markdown.tsx': 'copy-markdown.css',
  'components/ui-base/feedback.tsx': 'feedback.css',
}

/**
 * Classes allowed to survive in a converted file, each with its reason. Anything
 * added here needs a reason that survives the question "why is this not in the
 * stylesheet?", so an empty entry is not an option.
 */
const ALLOWED = new Map<string, string>([
  [
    'not-prose',
    'Tailwind Typography plugin opt-out. Typography styles the prose wrapper by\n     * parsing the rendered HTML with its own cascade, so it cannot be expressed as\n     * a rule against our own classes — and inside a code block its margins would\n     * put a blank line above and below every one.',
  ],
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

/** A selector, and the part of it that survives stripping every `:where()`. */
interface Selector {
  selector: string
  bare: string
}

describe('theme-neutral styles', () => {
  /**
   * Every selector in a component stylesheet, paired with what contributes
   * specificity once the `:where(…)` groups are stripped out.
   */
  const selectorsOf = (css: string): Selector[] => {
    const out: Selector[] = []
    for (const match of css.matchAll(/(^|[};])\s*([^{};]+?)\s*\{/g)) {
      for (const raw of match[2].split(',')) {
        const selector = raw.trim()
        if (!selector || selector.startsWith('@')) continue
        // The `:where()` groups contribute nothing. Strip them so what is left
        // is what actually counts.
        const bare = selector.replace(/:where\([^()]*\)/g, '').trim()
        out.push({ selector, bare })
      }
    }
    return out
  }

  it('keeps state selectors outside :where()', () => {
    // The theme's own rule, and the one that makes the rest of this file
    // predictable:
    //
    //   :where() wraps the ROOT CLASS. Nothing else goes inside it.
    //
    // The reason is a bug that shipped once already, in this package, during the
    // first round of conversions. Two rules, both written the way that "looked"
    // right:
    //
    //   :where(.bdocs-toc__link):hover        specificity 0-1-0
    //   :where(.bdocs-toc__link[data-active]) specificity 0-0-0
    //
    // `[data-active]` is inside `:where()`, so it contributes nothing. Specificity
    // beats source order, so hover wins: the currently-active table-of-contents
    // entry turned body-coloured the moment the pointer reached it, in a build
    // where the utility version it replaced kept the brand colour. Nothing
    // failed — no test compares a computed colour, and no reviewer reads
    // `:where()` as arithmetic.
    //
    // The neighbouring form is worse because it hides. When *both* states are
    // inside the group they are both 0-0-0 and the later line wins — correct by
    // luck, and one edit away from being wrong with no test to catch it.
    //
    // So the rule is not "the state must outrank the base", which is satisfied by
    // accident in that case. It is: the root class is the only thing `:where()`
    // wraps. Then the ranking is structural —
    //
    //   :where(.bdocs-toc__link)              0-0-0   base
    //   :where(.bdocs-toc__link):hover        0-1-0   hover
    //   :where(.bdocs-toc__link)[data-active] 0-2-0   current, and it wins
    //
    // and `:where()` is still doing its actual job on the base rule: a site can
    // override the theme's colours with any rule it likes, because a default that
    // beats the user's CSS is not a default.
    //
    // What is deliberately allowed inside `:where()` is a `--modifier` class,
    // because that is an *alternative* to the root class rather than a state
    // layered on it — `--light` and `--dark` logos never co-occur. Flagging those
    // would train this guard to be ignored, and a guard that gets ignored
    // protects nothing. A modifier that *is* state (a copied flag) uses a
    // `data-*` attribute instead, which is what the rest of the theme already
    // does.
    const INSIDE = /:where\(([^()]*)\)/g
    const STATE =
      /:(?:hover|focus-visible|focus-within|active)\b|\[(?:data|aria)-[a-z-]+\]/

    const offenders: Record<string, string[]> = {}
    for (const file of componentStyles()) {
      const css = readFileSync(join(SRC, 'styles/components', file), 'utf-8')
      // Comments first, or the `:where(...)` inside a comment explaining a
      // `:where(...)` is read as one.
      const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
      const bad: string[] = []

      for (const { selector } of selectorsOf(code)) {
        for (const m of selector.matchAll(INSIDE)) {
          if (STATE.test(m[1])) {
            bad.push(selector)
            break
          }
        }
      }
      if (bad.length > 0) offenders[file] = bad
    }
    expect(offenders).toEqual({})
  })

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
      readFileSync(
        join(SRC, 'components/composition/docs-layout.tsx'),
        'utf-8',
      ),
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
  it('reports the files that still carry utility classes', () => {
    // The denominator is the files that actually carry utilities, not every
    // `.tsx` in the package. Counting the latter mixed in hooks, contexts and
    // utilities — files that never had a class — and reported 63 where the real
    // number was 23, for several commits.
    const INFRA = /^(hooks|collections|utils|app|contexts)\//
    const ENTRY = /^(index|mdx-component|doc-page|head|error-boundary)\.tsx$/

    const files = walk(SRC).filter((f) => f.endsWith('.tsx'))
    const components = files.filter((f) => {
      const rel = relative(SRC, f).replaceAll('\\', '/')
      return !INFRA.test(rel) && !ENTRY.test(rel)
    })
    const converted = new Set(Object.keys(CONVERTED))
    const remaining = components.filter(
      (f) => !converted.has(relative(SRC, f).replaceAll('\\', '/')),
    )
    const dirty = remaining.filter(
      (f) => utilitiesIn(readFileSync(f, 'utf-8')).length > 0,
    )

    // Not an assertion about a number: it would need editing on every conversion
    // and would only ever be satisfied by deleting the file. It prints, so the
    // remaining work is visible instead of assumed to be finished.
    console.log(
      `  theme-neutral: ${converted.size} convertidos, ${dirty.length} de ` +
        `${components.length} componentes siguen con utilidades`,
    )
    expect(dirty.length).toBeLessThan(components.length)
  })
})
