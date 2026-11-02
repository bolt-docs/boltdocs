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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-e2e-'))

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
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
  })

  const keyFor = (relativePath: string) =>
    path.resolve(tempDir, relativePath).replace(/\\/g, '/')

  it('should discover and parse real nested MDX files', () => {
    const result = parseWithNapi(tempDir, false)
    expect(Object.keys(result)).toHaveLength(3)

    const indexDoc = result[keyFor('index.md')] as ParsedDoc
    expect(indexDoc).toBeDefined()
    expect(indexDoc.rawMatter).toContain('title: Home')
    expect(indexDoc.rawMatter).toContain('description: Welcome page')
    expect(indexDoc.content).toContain('# Welcome')
    expect(indexDoc.headings.length).toBeGreaterThanOrEqual(2)
    expect(indexDoc.headings.map((heading) => heading.text)).toEqual(
      expect.arrayContaining(['Getting Started', 'Features']),
    )
    expect(indexDoc.plainText).toContain('Fast')
    expect(indexDoc.plainText).toContain('Reliable')

    const guideDoc = result[keyFor('guides/getting-started.md')] as ParsedDoc
    expect(guideDoc).toBeDefined()
    expect(guideDoc.rawMatter).toContain('title: Getting Started')
    expect(guideDoc.rawMatter).toContain('sidebarPosition: 1')
    expect(guideDoc.headings).toHaveLength(2)
    expect(guideDoc.headings[0].text).toBe('Installation')
    expect(guideDoc.headings[1].text).toBe('Configuration')

    const apiDoc = result[keyFor('api.md')] as ParsedDoc
    expect(apiDoc).toBeDefined()
    expect(apiDoc.rawMatter).toContain('tags')
    expect(apiDoc.rawMatter).toContain('Bot')
    expect(apiDoc.headings.map((heading) => heading.text)).toEqual(
      expect.arrayContaining(['Endpoints', 'GET /users', 'POST /users']),
    )
  })

  it('should handle an empty directory gracefully', () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-empty-'))
    try {
      expect(parseWithNapi(emptyDir, false)).toEqual({})
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true })
    }
  })

  it('should produce consistent results with turbo mode', () => {
    const normalResult = parseWithNapi(tempDir, false)
    const turboResult = parseWithNapi(tempDir, true)

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
