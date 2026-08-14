import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { tryLoadNapi, parseWithNapi } from '../src/napi-binding'
import { runParserFiles } from '../index'
import type { ParsedDoc } from '../index'

// The shared library must be built before running this test:
//   cd packages/parser && pnpm build:napi
const NAPI_AVAILABLE = tryLoadNapi()

function createDocs(files: Record<string, string>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bdocs-parser-'))
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content)
  }
  return root
}

function normalized(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, '/')
}

describe.runIf(NAPI_AVAILABLE)('N-API binding unit tests', () => {
  beforeAll(() => {
    expect(tryLoadNapi()).toBe(true)
  })

  it('should discover and parse every Markdown file in a directory', () => {
    const root = createDocs({
      'selected.md': '## Selected',
      'nested/unrelated.md': '## Unrelated',
      'mixed.Md': '## Mixed case',
      'ignored/_private.md': '## Private',
    })

    try {
      const result = parseWithNapi(root, false)
      expect(Object.keys(result).sort()).toEqual(
        [
          normalized(path.join(root, 'mixed.Md')),
          normalized(path.join(root, 'nested/unrelated.md')),
          normalized(path.join(root, 'selected.md')),
        ].sort(),
      )
      expect(result[normalized(path.join(root, 'selected.md'))]).toBeDefined()
      expect(
        result[normalized(path.join(root, 'ignored/_private.md'))],
      ).toBeUndefined()
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('should parse a single file with frontmatter', () => {
    const root = createDocs({
      'doc.md': `---
title: Test Doc
draft: true
---
# Hello World

## Section 1

Some paragraph content here.`,
    })

    try {
      const result = parseWithNapi(root, false)
      const doc = result[normalized(path.join(root, 'doc.md'))] as ParsedDoc

      expect(doc).toBeDefined()
      expect(doc.rawMatter).toContain('title: Test Doc')
      expect(doc.rawMatter).toContain('draft: true')
      expect(doc.content).toContain('# Hello World')
      expect(doc.content).toContain('## Section 1')
      expect(doc.plainText).toContain('Hello World')
      expect(doc.plainText).toContain('Section 1')
      expect(doc.description.length).toBeGreaterThan(0)

      const headingTexts = doc.headings.map((heading) => heading.text)
      expect(headingTexts).toContain('Section 1')
      expect(headingTexts).not.toContain('Hello World')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('should parse a file without frontmatter', () => {
    const root = createDocs({
      'plain.md': '## Just Content\n\nNo frontmatter here.',
    })

    try {
      const doc = parseWithNapi(root, false)[
        normalized(path.join(root, 'plain.md'))
      ] as ParsedDoc
      expect(doc).toBeDefined()
      expect(doc.rawMatter).toBe('')
      expect(doc.headings).toHaveLength(1)
      expect(doc.headings[0].text).toBe('Just Content')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('should parse multiple files', () => {
    const root = createDocs({
      'a.md': '## File A',
      'b.md': '## File B',
      'c.md': '## File C',
    })

    try {
      const result = parseWithNapi(root, false)
      expect(Object.keys(result)).toHaveLength(3)
      expect(result[normalized(path.join(root, 'a.md'))]).toBeDefined()
      expect(result[normalized(path.join(root, 'b.md'))]).toBeDefined()
      expect(result[normalized(path.join(root, 'c.md'))]).toBeDefined()
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('should support turbo mode (single-pass)', () => {
    const root = createDocs({
      'turbo.md': `---
title: Turbo
---
## Turbo Section

Turbo content.`,
    })

    try {
      const key = normalized(path.join(root, 'turbo.md'))
      const normalDoc = parseWithNapi(root, false)[key] as ParsedDoc
      const turboDoc = parseWithNapi(root, true)[key] as ParsedDoc

      expect(turboDoc.rawMatter).toBe(normalDoc.rawMatter)
      expect(turboDoc.content).toBe(normalDoc.content)
      expect(turboDoc.headings).toHaveLength(normalDoc.headings.length)
      expect(turboDoc.plainText).toBe(normalDoc.plainText)
      expect(turboDoc.description).toBe(normalDoc.description)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('should handle empty files gracefully', () => {
    const root = createDocs({ 'empty.md': '' })

    try {
      const doc = parseWithNapi(root, false)[
        normalized(path.join(root, 'empty.md'))
      ] as ParsedDoc
      expect(doc).toBeDefined()
      expect(doc.rawMatter).toBe('')
      expect(doc.content).toBe('')
      expect(doc.headings).toHaveLength(0)
      expect(doc.plainText).toBe('')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('should handle files with complex frontmatter', () => {
    const root = createDocs({
      'complex.md': `---
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
## Complex Section`,
    })

    try {
      const doc = parseWithNapi(root, false)[
        normalized(path.join(root, 'complex.md'))
      ] as ParsedDoc
      expect(doc).toBeDefined()
      expect(doc.rawMatter).toContain('zig')
      expect(doc.rawMatter).toContain('docs')
      expect(doc.rawMatter).toContain('Jesus')
      expect(doc.content).toContain('Complex Section')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('should parse selected files without scanning unrelated files', async () => {
    const root = createDocs({
      'selected.md': '## Selected',
      'unrelated.md': '## Unrelated',
    })

    try {
      const selected = await runParserFiles(
        root,
        [path.join(root, 'selected.md')],
        false,
      )
      expect(Object.keys(selected)).toEqual([
        normalized(path.join(root, 'selected.md')),
      ])
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('file-scoped parser fallback', () => {
  it('returns only selected files when the native parser is bypassed', async () => {
    const root = createDocs({
      'selected.md': '## Selected',
      'unrelated.md': '## Unrelated',
    })
    const previousForceWasm = process.env.FORCE_WASM
    const previousForceExec = process.env.FORCE_EXEC
    process.env.FORCE_WASM = 'true'
    delete process.env.FORCE_EXEC

    try {
      const selected = await runParserFiles(
        root,
        [path.join(root, 'selected.md')],
        false,
      )
      expect(Object.keys(selected)).toEqual([
        normalized(path.join(root, 'selected.md')),
      ])
    } finally {
      if (previousForceWasm === undefined) delete process.env.FORCE_WASM
      else process.env.FORCE_WASM = previousForceWasm
      if (previousForceExec === undefined) delete process.env.FORCE_EXEC
      else process.env.FORCE_EXEC = previousForceExec
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('N-API library detection', () => {
  it('should detect whether the shared library is available', () => {
    expect(typeof tryLoadNapi()).toBe('boolean')
  })
})
