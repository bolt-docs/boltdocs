import { describe, it, expect } from 'vitest'
import { parseMetaString } from '../src'

describe('parseMetaString', () => {
  it('returns an empty object for empty input', () => {
    expect(parseMetaString('')).toEqual({})
  })

  it('extracts title="…" with double quotes', () => {
    expect(parseMetaString('title="my-title"')).toEqual({
      title: 'my-title',
    })
  })

  it('extracts title="…" with single quotes', () => {
    expect(parseMetaString("title='single'")).toEqual({ title: 'single' })
  })

  it('extracts lineNumbers / showLineNumbers', () => {
    expect(parseMetaString('lineNumbers')).toEqual({ lineNumbers: true })
    expect(parseMetaString('showLineNumbers')).toEqual({ lineNumbers: true })
    expect(parseMetaString('somethingElse')).toEqual({})
  })

  it('extracts wordWrap / word-wrap', () => {
    expect(parseMetaString('wordWrap')).toEqual({ wordWrap: true })
    expect(parseMetaString('word-wrap')).toEqual({ wordWrap: true })
  })

  it('combines multiple flags without re-extracting them as keys', () => {
    expect(parseMetaString('title="X" lineNumbers wordWrap')).toEqual({
      title: 'X',
      lineNumbers: true,
      wordWrap: true,
    })
  })
})
