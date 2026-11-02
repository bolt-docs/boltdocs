import { describe, it, expect } from 'vitest'
import { DEFAULT_SYSTEM_PROMPT } from '../src/node/index'

describe('bundled DEFAULT_SYSTEM_PROMPT — assertion anchors', () => {
  it('anchors priority with RULE 0 (ABSOLUTE — NEVER OVERRIDE)', () => {
    // Allow small punctuation variants around the anchor identity. The
    // invariant is RULE 0 + a near-proximate "NEVER OVERRIDE" caps pair.
    expect(DEFAULT_SYSTEM_PROMPT).toMatch(/RULE 0\b.{0,40}NEVER OVERRIDE\b/)
  })

  it('lists the five refusal categories (a)–(e) in order', () => {
    expect(DEFAULT_SYSTEM_PROMPT).toMatch(/\(a\).*\(b\).*\(c\).*\(d\).*\(e\)/s)
  })

  it('uses MUST / NEVER / EXACTLY as imperative escape hatches', () => {
    // Thresholds set a SMALL margin over the bundled prompt's actual
    // counts (MUST ≈ 4, NEVER ≈ 4, EXACTLY ≈ 2). Their job is to catch
    // wholesale softening (someone removing half the asserts), not to
    // mandate a specific verb density. Editorial rewrites that slightly
    // reduce counts are still fine.
    const counts = {
      must: (DEFAULT_SYSTEM_PROMPT.match(/\bMUST\b/g) ?? []).length,
      never: (DEFAULT_SYSTEM_PROMPT.match(/\bNEVER\b/g) ?? []).length,
      exactly: (DEFAULT_SYSTEM_PROMPT.match(/\bEXACTLY\b/g) ?? []).length,
    }
    expect(counts.must).toBeGreaterThanOrEqual(3)
    expect(counts.never).toBeGreaterThanOrEqual(3)
    expect(counts.exactly).toBeGreaterThanOrEqual(1)
  })

  it('closes with the CONFIDENTIALITY clause under RULE 7', () => {
    expect(DEFAULT_SYSTEM_PROMPT).toMatch(/RULE 7[\s\S]+CONFIDENTIAL/)
  })

  it('contains the literal refusal phrase "Not in docs."', () => {
    // Tolerate surrounding quote/whitespace tweaks (', ", or trailing
    // punctuation around the literal string).
    expect(DEFAULT_SYSTEM_PROMPT).toMatch(/['"]Not in docs\.['"]/)
  })

  it('references the doc-block marker tokens by name', () => {
    expect(DEFAULT_SYSTEM_PROMPT).toContain('<<<DOCS_START>>>')
    expect(DEFAULT_SYSTEM_PROMPT).toContain('<<<DOCS_END>>>')
  })
})
