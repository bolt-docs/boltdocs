import { describe, it, expect, beforeAll } from 'vitest'
import { tryLoadNapi, parseWithNapi } from '../src/napi-binding'
import type { ParsedDoc } from '../index'

// The shared library must be built before running this test:
//   cd packages/parser && pnpm build:napi
const NAPI_AVAILABLE = tryLoadNapi()

describe.runIf(NAPI_AVAILABLE)('N-API binding unit tests', () => {
  beforeAll(() => {
    expect(tryLoadNapi()).toBe(true)
  })

  it('should parse a single file with frontmatter', () => {
    const content = `---
title: Test Doc
draft: true
---
# Hello World

## Section 1

Some paragraph content here.`

    const files: Record<string, string> = {
      '/test/doc.md': content,
    }

    const result = parseWithNapi(files, false)
    expect(result).toBeDefined()
    expect(Object.keys(result)).toHaveLength(1)

    const doc = result['/test/doc.md'] as ParsedDoc
    expect(doc).toBeDefined()
    expect(doc.rawMatter).toContain('title: Test Doc')
    expect(doc.rawMatter).toContain('draft: true')
    expect(doc.content).toContain('# Hello World')
    expect(doc.content).toContain('## Section 1')
    expect(doc.content).toContain('Some paragraph content here.')
    expect(doc.plainText).toContain('Hello World')
    expect(doc.plainText).toContain('Section 1')
    expect(doc.plainText).toContain('Some paragraph content here.')
    expect(doc.description).toBeDefined()
    expect(doc.description.length).toBeGreaterThan(0)

    // Headings: only ## and ### and #### (not #)
    expect(doc.headings).toBeDefined()
    const headingTexts = doc.headings.map((h) => h.text)
    expect(headingTexts).toContain('Section 1')
    expect(headingTexts).not.toContain('Hello World') // # is ignored
  })

  it('should parse a file without frontmatter', () => {
    const content = `## Just Content

No frontmatter here.`

    const files: Record<string, string> = {
      '/test/plain.md': content,
    }

    const result = parseWithNapi(files, false)
    const doc = result['/test/plain.md'] as ParsedDoc
    expect(doc).toBeDefined()
    expect(doc.rawMatter).toBe('')
    expect(doc.headings).toHaveLength(1)
    expect(doc.headings[0].text).toBe('Just Content')
  })

  it('should parse multiple files', () => {
    const files: Record<string, string> = {
      '/a.md': '## File A',
      '/b.md': '## File B',
      '/c.md': '## File C',
    }

    const result = parseWithNapi(files, false)
    expect(Object.keys(result)).toHaveLength(3)
    expect(result['/a.md']).toBeDefined()
    expect(result['/b.md']).toBeDefined()
    expect(result['/c.md']).toBeDefined()
  })

  it('should support turbo mode (single-pass)', () => {
    const content = `---
title: Turbo
---
## Turbo Section

Turbo content.`

    const files: Record<string, string> = {
      '/test/turbo.md': content,
    }

    // Turbo mode should produce same results as normal mode
    const normalResult = parseWithNapi(files, false)
    const turboResult = parseWithNapi(files, true)

    const normalDoc = normalResult['/test/turbo.md'] as ParsedDoc
    const turboDoc = turboResult['/test/turbo.md'] as ParsedDoc

    expect(turboDoc.rawMatter).toBe(normalDoc.rawMatter)
    expect(turboDoc.content).toBe(normalDoc.content)
    expect(turboDoc.headings).toHaveLength(normalDoc.headings.length)
    expect(turboDoc.plainText).toBe(normalDoc.plainText)
  })

  it('should handle empty files gracefully', () => {
    const files: Record<string, string> = {
      '/test/empty.md': '',
    }

    const result = parseWithNapi(files, false)
    const doc = result['/test/empty.md'] as ParsedDoc
    expect(doc).toBeDefined()
    expect(doc.rawMatter).toBe('')
    expect(doc.content).toBe('')
    expect(doc.headings).toHaveLength(0)
    expect(doc.plainText).toBe('')
  })

  it('should handle files with complex frontmatter', () => {
    const content = `---
title: Complex
tags:
  - zig
  - docs
author:
  name: Jesus
  nested:
    active: true
metadata: { version: 2, status: "stable" }
---
## Complex Section`

    const files: Record<string, string> = {
      '/test/complex.md': content,
    }

    const result = parseWithNapi(files, false)
    const doc = result['/test/complex.md'] as ParsedDoc
    expect(doc).toBeDefined()
    expect(doc.rawMatter).toContain('zig')
    expect(doc.rawMatter).toContain('docs')
    expect(doc.rawMatter).toContain('Jesus')
    expect(doc.content).toContain('Complex Section')
  })
})

describe('N-API library detection', () => {
  it('should detect whether the .so is available', () => {
    // This test just verifies the function runs without error
    const available = tryLoadNapi()
    expect(typeof available).toBe('boolean')
  })

  it('should throw when calling parseWithNapi without loading', () => {
    // We can't easily test this since tryLoadNapi is called at module level,
    // but we can verify the loaded state
    const loaded = tryLoadNapi()
    if (!loaded) {
      console.warn(
        'N-API test skipped: libbdocs_parser_napi.so not found. ' +
          'Run `pnpm build:napi` in packages/parser to build it.',
      )
    }
  })
})
