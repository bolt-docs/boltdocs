import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const RESET = resolve(HERE, '../../src/client/theme/reset.css')

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
