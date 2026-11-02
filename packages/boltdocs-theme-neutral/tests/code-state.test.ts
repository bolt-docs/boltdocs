import { describe, expect, it } from 'vitest'
import {
  cleanHighlightedHtml,
  isHighlighted,
  readCodeBlockState,
  readLineCount,
  shouldOfferExpand,
} from '../src/components/mdx/code-state'

/**
 * These tests exist because each function replaced a guess.
 *
 * All three read state the pipeline publishes, because all three used to infer
 * it from Shiki's output: `className.includes('shiki')` to decide a block was
 * highlighted, and `<span class="line">` counting to decide how tall it was.
 * Both guesses happen to be right for Shiki and wrong for everything else,
 * which is the kind of bug that survives until the second engine is installed.
 */
describe('readCodeBlockState', () => {
  it('reads the state the pipeline published', () => {
    expect(readCodeBlockState({ 'data-code-state': 'highlighted' })).toBe(
      'highlighted',
    )
    expect(readCodeBlockState({ 'data-code-state': 'plaintext' })).toBe(
      'plaintext',
    )
    expect(readCodeBlockState({ 'data-code-state': 'fallback' })).toBe(
      'fallback',
    )
  })

  it('never consults the class name', () => {
    // The engine puts its own class on the block. Reading it would make the
    // view decide that an engine it has not heard of produced nothing.
    expect(
      readCodeBlockState({
        'data-code-state': 'highlighted',
        className: 'foreign-engine-output',
      } as never),
    ).toBe('highlighted')
  })

  it('falls back to data-highlighted for a plugin that emits only that', () => {
    expect(readCodeBlockState({ 'data-highlighted': 'true' })).toBe(
      'highlighted',
    )
    expect(readCodeBlockState({ 'data-highlighted': 'false' })).toBe('fallback')
  })

  it('ignores an unrecognised state rather than trusting it', () => {
    // A future engine publishing `data-code-state="rehydrated"` should fall
    // back to the coarse signal, not render as `none` and drop its styling.
    expect(
      readCodeBlockState({
        'data-code-state': 'rehydrated',
        'data-highlighted': 'true',
      }),
    ).toBe('highlighted')
  })

  it('reports no state when nothing claimed the block', () => {
    expect(readCodeBlockState({})).toBe('none')
  })
})

describe('isHighlighted', () => {
  it('is true only for a coloured block', () => {
    expect(isHighlighted('highlighted')).toBe(true)
    // Plaintext went through an engine and keeps engine styling; only the
    // tokens are missing, and treating it as unhighlighted would strip that.
    expect(isHighlighted('plaintext')).toBe(false)
    expect(isHighlighted('fallback')).toBe(false)
    expect(isHighlighted('none')).toBe(false)
  })
})

describe('cleanHighlightedHtml', () => {
  it('drops the empty trailing line span', () => {
    const html =
      '<pre><code><span class="line">const a = 1</span><span class="line">  <span> </span></span></code></pre>'
    expect(cleanHighlightedHtml(html)).not.toContain('<span class="line">  ')
  })

  it('leaves markup from an engine that emits nothing like it alone', () => {
    // An engine whose output has no empty trailing span is returned
    // byte-for-byte. A blanket rewrite would corrupt it.
    const html = '<pre><code><div class="c">const a = 1</div></code></pre>'
    expect(cleanHighlightedHtml(html)).toBe(html)
  })
})

describe('readLineCount', () => {
  it('prefers the count the pipeline published', () => {
    expect(
      readLineCount({ 'data-line-count': '42' }, '<pre>irrelevant</pre>'),
    ).toBe(42)
  })

  it('accepts a numeric count', () => {
    expect(readLineCount({ 'data-line-count': 7 })).toBe(7)
  })

  it('ignores a count that is not a positive number', () => {
    // `0` means "the engine did not say", not "this block is empty" — falling
    // through to the HTML is what makes a block from an engine without a count
    // still expandable.
    expect(
      readLineCount({ 'data-line-count': '0' }, undefined, 'a\nb\nc'),
    ).toBe(3)
    expect(
      readLineCount({ 'data-line-count': 'nope' }, undefined, 'a\nb'),
    ).toBe(2)
  })

  it('counts lines in plain text', () => {
    expect(readLineCount({}, undefined, 'one\ntwo\nthree')).toBe(3)
  })

  it('counts lines in an array of children', () => {
    expect(readLineCount({}, undefined, ['one\ntwo', 'three'])).toBe(3)
  })

  it('reports zero when it cannot measure, which renders as not expandable', () => {
    // Zero is the safe direction: an unmeasured block is not collapsed in a way
    // that hides its content.
    expect(readLineCount({}, undefined, undefined)).toBe(0)
  })

  it('measures engine markup that publishes no count', () => {
    const html =
      '<pre><code><div>a</div><div>b</div><div>c</div><div>d</div></code></pre>'
    expect(readLineCount({}, html)).toBe(4)
  })
})

describe('shouldOfferExpand', () => {
  it('offers the control only above the threshold', () => {
    expect(shouldOfferExpand(3)).toBe(false)
    expect(shouldOfferExpand(12)).toBe(false)
    expect(shouldOfferExpand(13)).toBe(true)
  })

  it('never offers it for a block that could not be measured', () => {
    expect(shouldOfferExpand(0)).toBe(false)
  })
})
