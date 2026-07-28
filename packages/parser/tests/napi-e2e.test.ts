import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { tryLoadNapi, parseWithNapi } from '../src/napi-binding'
import type { ParsedDoc } from '../index'

const NAPI_AVAILABLE = tryLoadNapi()

describe.runIf(NAPI_AVAILABLE)('N-API E2E: real MDX files', () => {
  let tempDir: string

  beforeAll(() => {
    expect(tryLoadNapi()).toBe(true)

    // Create temp directory with test MDX files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-e2e-'))

    // File 1: Simple doc with frontmatter
    fs.writeFileSync(
      path.join(tempDir, 'index.md'),
      `---
title: Home
description: Welcome page
---
# Welcome

## Getting Started

Welcome to the documentation!

## Features

- Fast
- Reliable
- Easy to use`,
    )

    // File 2: Nested doc
    const subDir = path.join(tempDir, 'guides')
    fs.mkdirSync(subDir, { recursive: true })
    fs.writeFileSync(
      path.join(subDir, 'getting-started.md'),
      `---
title: Getting Started
sidebarPosition: 1
---
## Installation

Run the following command:

## Configuration

Configure your settings.`,
    )

    // File 3: Doc with complex frontmatter
    fs.writeFileSync(
      path.join(tempDir, 'api.md'),
      `---
title: API Reference
tags:
  - api
  - reference
author:
  name: Bot
  url: https://example.com
---
## Endpoints

### GET /users

Returns all users.

### POST /users

Creates a new user.`,
    )
  })

  afterAll(() => {
    if (tempDir) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  function readDocsDir(dir: string): Record<string, string> {
    const files: Record<string, string> = {}

    function walk(currentDir: string) {
      let entries: fs.Dirent[]
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true })
      } catch {
        return
      }

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name)
        if (entry.isDirectory()) {
          if (!entry.name.startsWith('_')) {
            walk(fullPath)
          }
        } else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8')
            files[fullPath.replace(/\\\\/g, '/')] = content
          } catch {
            // skip
          }
        }
      }
    }

    walk(dir)
    return files
  }

  it('should read files from temp dir and parse them', () => {
    const files = readDocsDir(tempDir)
    expect(Object.keys(files)).toHaveLength(3)

    const result = parseWithNapi(files, false)
    expect(Object.keys(result)).toHaveLength(3)

    // Verify index.md
    const indexKey = Object.keys(result).find((k) => k.endsWith('index.md'))
    expect(indexKey).toBeDefined()
    const indexDoc = result[indexKey!] as ParsedDoc
    expect(indexDoc.rawMatter).toContain('title: Home')
    expect(indexDoc.rawMatter).toContain('description: Welcome page')
    expect(indexDoc.content).toContain('# Welcome')
    expect(indexDoc.headings.length).toBeGreaterThanOrEqual(2)
    const indexHeadings = indexDoc.headings.map((h) => h.text)
    expect(indexHeadings).toContain('Getting Started')
    expect(indexHeadings).toContain('Features')
    expect(indexDoc.plainText).toContain('Getting Started')
    expect(indexDoc.plainText).toContain('Fast')
    expect(indexDoc.plainText).toContain('Reliable')

    // Verify guides/getting-started.md
    const guideKey = Object.keys(result).find((k) =>
      k.endsWith('getting-started.md'),
    )
    expect(guideKey).toBeDefined()
    const guideDoc = result[guideKey!] as ParsedDoc
    expect(guideDoc.rawMatter).toContain('title: Getting Started')
    expect(guideDoc.rawMatter).toContain('sidebarPosition: 1')
    expect(guideDoc.headings).toHaveLength(2)
    expect(guideDoc.headings[0].text).toBe('Installation')
    expect(guideDoc.headings[1].text).toBe('Configuration')

    // Verify api.md
    const apiKey = Object.keys(result).find((k) => k.endsWith('api.md'))
    expect(apiKey).toBeDefined()
    const apiDoc = result[apiKey!] as ParsedDoc
    expect(apiDoc.rawMatter).toContain('tags')
    expect(apiDoc.rawMatter).toContain('api')
    expect(apiDoc.rawMatter).toContain('author')
    expect(apiDoc.rawMatter).toContain('Bot')
    // Check nested headings (###)
    const apiHeadings = apiDoc.headings.map((h) => h.text)
    expect(apiHeadings).toContain('Endpoints')
    expect(apiHeadings).toContain('GET /users')
    expect(apiHeadings).toContain('POST /users')
  })

  it('should handle empty temp dir gracefully', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-empty-'))
    try {
      const files = readDocsDir(emptyDir)
      expect(Object.keys(files)).toHaveLength(0)
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true })
    }
  })

  it('should produce consistent results with turbo mode', () => {
    const files = readDocsDir(tempDir)

    const normalResult = parseWithNapi(files, false)
    const turboResult = parseWithNapi(files, true)

    // Compare results for each file
    for (const key of Object.keys(normalResult)) {
      const normalDoc = normalResult[key] as ParsedDoc
      const turboDoc = turboResult[key] as ParsedDoc
      expect(turboDoc.rawMatter).toBe(normalDoc.rawMatter)
      expect(turboDoc.content).toBe(normalDoc.content)
      expect(turboDoc.headings).toHaveLength(normalDoc.headings.length)
      expect(turboDoc.plainText).toBe(normalDoc.plainText)
      expect(turboDoc.description).toBe(normalDoc.description)
    }
  })
})
