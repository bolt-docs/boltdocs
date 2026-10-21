import { describe, expect, it } from 'vitest'
import { compareStylesheets } from './compare-stylesheets'

describe('compareStylesheets', () => {
  it('reports nothing for two files that resolve the same', () => {
    const before =
      ':root{--color-main:#060606}body{background-color:var(--color-main)}'
    const after =
      ':root{--bdocs-canvas:#060606}body{background-color:var(--bdocs-canvas)}'

    expect(compareStylesheets(before, after)).toEqual([])
  })

  it('reports a value that actually changed', () => {
    const before =
      ':root{--color-main:#060606}body{background-color:var(--color-main)}'
    const after =
      ':root{--bdocs-canvas:#ffffff}body{background-color:var(--bdocs-canvas)}'

    const differences = compareStylesheets(before, after)
    expect(differences).toHaveLength(1)
    expect(differences[0].property).toBe('background-color')
    expect(differences[0].before).toBe('#060606')
    expect(differences[0].after).toBe('#ffffff')
  })

  it('does not report a rule that only moved', () => {
    // A build may split one rule into two, or merge two into one. The
    // rendering does not change.
    const before = '.a{color:red}.b{color:red}'
    const after = '.a{color:red}.b{color:red}'

    expect(compareStylesheets(before, after)).toEqual([])
  })

  it('ignores Tailwind’s bookkeeping properties', () => {
    // `--tw-*` carries no rendering. A file without them renders the same.
    const before = '.a{--tw-leading:1.6;line-height:1.6}'
    const after = '.a{line-height:1.6}'

    expect(compareStylesheets(before, after)).toEqual([])
  })

  it('sees through a calculation', () => {
    const before = '.a{padding-block:calc(.25rem * 2)}'
    const after = '.a{padding-block:.5rem}'

    expect(compareStylesheets(before, after)).toEqual([])
  })

  it('does not confuse a selector list with a different order', () => {
    const before = '.a,.b{color:red}'
    const after = '.b,.a{color:red}'

    expect(compareStylesheets(before, after)).toEqual([])
  })

  it('expands `:is()` so the two spellings of a rule meet', () => {
    const before = ':is(.a,.b){color:red}'
    const after = '.a{color:red}.b{color:red}'

    expect(compareStylesheets(before, after)).toEqual([])
  })
})
