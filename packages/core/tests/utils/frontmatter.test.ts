import { describe, it, expect } from 'vitest'
import { parseFrontmatterFast, MAX_FRONTMATTER_SIZE } from '../../src/node/utils/frontmatter'

describe('parseFrontmatterFast', () => {
  it('should return empty data when no frontmatter', () => {
    const result = parseFrontmatterFast('# Hello World')
    expect(result.data).toEqual({})
    expect(result.content).toBe('# Hello World')
  })

  it('should parse simple key-value', () => {
    const input = `---
title: Hello World
description: A test document
---
# Content`
    const result = parseFrontmatterFast(input)
    expect(result.data).toEqual({
      title: 'Hello World',
      description: 'A test document',
    })
  })

  it('should parse boolean values', () => {
    const input = `---
enabled: true
disabled: false
---
`
    const result = parseFrontmatterFast(input)
    expect(result.data).toEqual({ enabled: true, disabled: false })
  })

  it('should parse number values', () => {
    const input = `---
count: 42
price: 19.99
negative: -5
---
`
    const result = parseFrontmatterFast(input)
    expect(result.data).toEqual({ count: 42, price: 19.99, negative: -5 })
  })

  it('should parse null values', () => {
    const input = `---
empty: null
alsoNull: ~
---
`
    const result = parseFrontmatterFast(input)
    expect(result.data).toEqual({ empty: null, alsoNull: null })
  })

  it('should parse quoted strings', () => {
    const input = `---
title: "Hello World"
single: 'Single Quotes'
---
`
    const result = parseFrontmatterFast(input)
    expect(result.data).toEqual({ title: 'Hello World', single: 'Single Quotes' })
  })

  it('should parse arrays', () => {
    const input = `---
tags:
  - one
  - two
  - three
---
`
    const result = parseFrontmatterFast(input)
    expect(result.data).toEqual({ tags: ['one', 'two', 'three'] })
  })

  it('should parse arrays with objects', () => {
    const input = `---
tabs:
  - id: intro
    title: Introduction
  - id: api
    title: API Reference
---
`
    const result = parseFrontmatterFast(input)
    expect(result.data.tabs).toHaveLength(2)
    expect((result.data.tabs as any[])[0].id).toBe('intro')
    expect((result.data.tabs as any[])[1].id).toBe('api')
  })

  it('should parse inline objects', () => {
    const input = `---
config: { theme: dark, lang: en }
---
`
    const result = parseFrontmatterFast(input)
    expect(result.data).toEqual({ config: { theme: 'dark', lang: 'en' } })
  })

  it('should handle comments', () => {
    const input = `---
title: Test
# This is a comment
description: With comment
---
`
    const result = parseFrontmatterFast(input)
    expect(result.data).toEqual({ title: 'Test', description: 'With comment' })
  })

  it('should return rawMatter', () => {
    const input = `---
title: Test
---
`
    const result = parseFrontmatterFast(input)
    expect(result.rawMatter).toBe('title: Test')
  })

  it('should handle empty frontmatter block', () => {
    const input = `---
---
# Content`
    const result = parseFrontmatterFast(input)
    expect(result.data).toEqual({})
    expect(result.content).toBe('# Content')
  })

  it('should handle nested objects', () => {
    const input = `---
settings:
  theme: dark
---
`
    const result = parseFrontmatterFast(input)
    expect(result.data.settings).toEqual({ theme: 'dark' })
  })

  it('should return content after frontmatter', () => {
    const input = `---
title: Test
---
# Hello World

Some content here.`
    const result = parseFrontmatterFast(input)
    expect(result.content).toBe('# Hello World\n\nSome content here.')
  })

  it('should handle no delimiter', () => {
    const input = `title: Test
---
# Content`
    const result = parseFrontmatterFast(input)
    expect(result.data).toEqual({})
    expect(result.content).toBe(input)
  })

  it('should handle unclosed quotes', () => {
    const input = `---
title: "unclosed
---
# Content`
    const result = parseFrontmatterFast(input)
    expect(result.data).toEqual({})
    expect(result.content).toContain('# Content')
  })

  it('should handle empty value', () => {
    const input = `---
title:
description: Test
---
`
    const result = parseFrontmatterFast(input)
    expect(result.data.description).toBe('Test')
  })

  it('should handle multiple keys with same name', () => {
    const input = `---
title: First
title: Second
---
`
    const result = parseFrontmatterFast(input)
    expect(result.data.title).toBe('Second')
  })

  it('should handle special characters in values', () => {
    const input = `---
path: /docs/guide?foo=bar&baz=qux
regex: ^\\d+$
---
`
    const result = parseFrontmatterFast(input)
    expect(result.data).toEqual({
      path: '/docs/guide?foo=bar&baz=qux',
      regex: '^\\d+$',
    })
  })
})

describe('MAX_FRONTMATTER_SIZE', () => {
  it('should be a reasonable number', () => {
    expect(MAX_FRONTMATTER_SIZE).toBeGreaterThan(1000)
    expect(MAX_FRONTMATTER_SIZE).toBeLessThan(10000000)
  })
})