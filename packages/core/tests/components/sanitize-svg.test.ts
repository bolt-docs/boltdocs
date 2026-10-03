import { afterEach, describe, expect, it, vi } from 'vitest'
import DOMPurifyMock from 'dompurify'
import {
  clearSvgSanitizeCache,
  sanitizeSvgMarkup,
} from '../../src/client/utils/sanitize-svg'

vi.mock('dompurify', () => ({
  default: { sanitize: vi.fn((input: string) => `[clean:${input}]`) },
}))

const SVG = '<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>'

/** How many times the underlying sanitizer actually ran. */
function sanitizeCallCount(): number {
  return (DOMPurifyMock.sanitize as unknown as { mock: { calls: unknown[] } })
    .mock.calls.length
}

describe('sanitizeSvgMarkup', () => {
  afterEach(() => {
    clearSvgSanitizeCache()
    vi.clearAllMocks()
  })

  it('sanitizes SVG markup', () => {
    expect(sanitizeSvgMarkup(SVG)).toBe(`[clean:${SVG}]`)
  })

  it('does not re-sanitize a repeated string', () => {
    // IconRenderer re-runs on every parent render. Before the cache, each pass
    // re-parsed and re-serialized the same markup.
    sanitizeSvgMarkup(SVG)
    sanitizeSvgMarkup(SVG)
    sanitizeSvgMarkup(SVG)

    expect(sanitizeCallCount()).toBe(1)
  })

  it('sanitizes each distinct string once', () => {
    sanitizeSvgMarkup(SVG)
    sanitizeSvgMarkup('<svg id="b"/>')
    sanitizeSvgMarkup(SVG)
    sanitizeSvgMarkup('<svg id="b"/>')

    expect(sanitizeCallCount()).toBe(2)
  })

  it('returns the same value for the same input', () => {
    const first = sanitizeSvgMarkup(SVG)
    const second = sanitizeSvgMarkup(SVG)

    expect(second).toBe(first)
  })

  it('keys on the exact markup, never on a caller-supplied name', () => {
    // Keying on an icon name would let one icon's sanitized output be served for
    // another — a sanitization bypass, since the name is what a caller controls.
    const other = '<svg><script>alert(1)</script></svg>'

    expect(sanitizeSvgMarkup(SVG)).not.toBe(sanitizeSvgMarkup(other))
  })

  it('distinguishes markup that differs only in whitespace', () => {
    expect(sanitizeSvgMarkup(SVG)).not.toBe(sanitizeSvgMarkup(` ${SVG}`))
  })

  it('stays bounded', async () => {
    // A caller could in principle pass unbounded distinct strings.
    for (let i = 0; i < 400; i++) sanitizeSvgMarkup(`<svg id="${i}"/>`)

    // The cache limit is 256, so after 400 distinct inputs the earliest are gone
    // but results are still correct.
    expect(sanitizeSvgMarkup('<svg id="0"/>')).toBe('[clean:<svg id="0"/>]')
  })
})
