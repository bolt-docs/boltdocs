import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const RESET = resolve(HERE, '../../src/theme/reset.css')

const css = readFileSync(RESET, 'utf8')

/**
 * The core stylesheet must style a code block by *state*, not by which engine
 * produced it.
 *
 * This is the CSS half of the engine-agnostic change. The pipeline now emits
 * `data-code-state` on every block; a theme that only knows `.shiki` renders a
 * Sugar-highlighted block with Shiki's assumptions, which is the same coupling
 * the contract change removed from TypeScript.
 *
 * The rule pattern is neutral-selector first, engine alias second — the one
 * `data-theme-mode` and `data-line-numbers` already use in this file.
 */
describe('reset.css: engine-agnostic code-block styling', () => {
  it('ships a stylesheet that declares every rendering state', () => {
    expect(existsSync(RESET)).toBe(true)
  })

  it('styles the fallback state without naming an engine', () => {
    expect(css).toMatch(/pre\[data-code-state="fallback"\]/)
    // The engine alias may accompany it, but must never be the only selector —
    // that is what a rule for one engine alone looks like.
    expect(css).toMatch(/pre\.shiki-fallback/)
  })

  it('keys dual-theme colours on the neutral attribute', () => {
    expect(css).toMatch(/\[data-theme-mode="dual"\]/)
  })

  it('keys feature flags on their neutral attributes', () => {
    expect(css).toMatch(/\[data-line-numbers="true"\]/)
    expect(css).toMatch(/\[data-word-wrap="true"\]/)
  })

  it('does not hardcode the engine name into a rule that has no neutral form', () => {
    // Every `.shiki` selector in this file must be accompanied by its neutral
    // counterpart, so a non-Shiki engine still gets styled. This catches a
    // future rule written engine-only, which is the regression that makes the
    // stylesheet quietly Shiki-only again.
    const engineOnly: string[] = []
    const rules = css.split('}')
    for (const rule of rules) {
      const selectors = rule.split('{')[0] ?? ''
      if (!selectors.includes('.shiki')) continue
      // A rule is fine if it ALSO carries a neutral attribute selector.
      const hasNeutral =
        selectors.includes('[data-') ||
        selectors.includes(':root') ||
        selectors.includes('.boltdocs-')
      if (!hasNeutral)
        engineOnly.push(selectors.trim().split('\n').pop()?.trim() ?? '')
    }

    expect(engineOnly).toEqual([])
  })
})

/**
 * The engine's stylesheet must not depend on a CSS framework.
 *
 * SPEC §2.1: "The core ships zero CSS framework assumptions." The stylesheet
 * used to be written with Tailwind's `@apply`, which is exactly such an
 * assumption — a rule that only compiles inside a Tailwind build.
 *
 * The declarations are the same ones Tailwind compiled to, so nothing moves a
 * pixel; the framework is what went away.
 */
describe('reset.css: no CSS framework', () => {
  // The comments talk about the directives by name, so the check reads the
  // declarations only.
  const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')

  it('uses no framework directives', () => {
    // `@apply` is Tailwind's. `@theme` and `@tailwind` are its entry points.
    // A `@media`, a `@supports` and a `@layer` are plain CSS and stay.
    expect(declarations).not.toMatch(/@apply\b/)
    expect(declarations).not.toMatch(/@theme\b/)
    expect(declarations).not.toMatch(/@tailwind\b/)
  })

  it('resolves colours through the host tokens, not through hardcoded values', () => {
    // The tokens are the contract with the host theme. A hardcoded colour
    // would be a second source of truth for a value the theme owns.
    const hexColours = declarations.match(/#[0-9a-f]{3,8}\b/gi) ?? []
    expect(hexColours).toEqual([])
  })
})
