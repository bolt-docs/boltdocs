#!/usr/bin/env node
/**
 * N-API binding standalone test runner.
 * Run with: tsx tests/run-napi-tests.ts
 * Requires: libbdocs_parser_napi.so to be built (pnpm build:napi)
 */
import { tryLoadNapi, parseWithNapi } from '../src/napi-binding'
import type { ParsedDoc } from '../index'

let passed = 0
let failed = 0

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++
    console.log(`  ✅ ${message}`)
  } else {
    failed++
    console.error(`  ❌ ${message}`)
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual === expected) {
    passed++
    console.log(`  ✅ ${message}`)
  } else {
    failed++
    console.error(
      `  ❌ ${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    )
  }
}

function assertContains(actual: string, expected: string, message: string) {
  if (actual.includes(expected)) {
    passed++
    console.log(`  ✅ ${message}`)
  } else {
    failed++
    console.error(
      `  ❌ ${message}: expected "${actual}" to contain "${expected}"`,
    )
  }
}

function assertDefined(value: unknown, message: string) {
  if (value !== undefined && value !== null) {
    passed++
    console.log(`  ✅ ${message}`)
  } else {
    failed++
    console.error(`  ❌ ${message}: value is ${value}`)
  }
}

// =============================================================================
// Test suite
// =============================================================================

function testNapiBindingAvailability() {
  console.log('\n📦 N-API Library Detection')

  const available = tryLoadNapi()
  if (!available) {
    console.log(
      '  ⚠️  libbdocs_parser_napi.so not found. Skipping all N-API tests.',
    )
    console.log('  Run: pnpm build:napi')
    return false
  }
  assert(available, 'tryLoadNapi() returns true')
  return true
}

function testSingleFileWithFrontmatter() {
  console.log('\n📄 Single File with Frontmatter')

  const content = `---
title: Test Doc
draft: true
---
# Hello World

## Section 1

Some paragraph content here.`

  const files: Record<string, string> = { '/test/doc.md': content }
  const result = parseWithNapi(files, false)

  assertDefined(result, 'result is defined')
  assertEqual(Object.keys(result).length, 1, 'result has 1 file')

  const doc = result['/test/doc.md'] as ParsedDoc
  assertDefined(doc, 'doc is defined')
  assertContains(doc.rawMatter, 'title: Test Doc', 'rawMatter contains title')
  assertContains(doc.rawMatter, 'draft: true', 'rawMatter contains draft')
  assertContains(doc.content, '# Hello World', 'content contains heading')
  assertContains(doc.plainText, 'Hello World', 'plainText contains title')

  assert(doc.headings.length > 0, 'has headings')
  const headingTexts = doc.headings.map((h) => h.text)
  assert(headingTexts.includes('Section 1'), 'heading has Section 1')
  assert(!headingTexts.includes('Hello World'), '# heading is ignored')
}

function testFileWithoutFrontmatter() {
  console.log('\n📄 File Without Frontmatter')

  const files: Record<string, string> = {
    '/test/plain.md': '## Just Content\n\nNo frontmatter.',
  }
  const result = parseWithNapi(files, false)
  const doc = result['/test/plain.md'] as ParsedDoc

  assertDefined(doc, 'doc is defined')
  assertEqual(doc.rawMatter, '', 'rawMatter is empty')
  assertEqual(doc.headings.length, 1, 'has 1 heading')
  assertEqual(doc.headings[0].text, 'Just Content', 'heading text is correct')
}

function testMultipleFiles() {
  console.log('\n📚 Multiple Files')

  const files: Record<string, string> = {
    '/a.md': '## File A',
    '/b.md': '## File B',
    '/c.md': '## File C',
  }
  const result = parseWithNapi(files, false)

  assertEqual(Object.keys(result).length, 3, 'result has 3 files')
  assertDefined(result['/a.md'], 'file A exists')
  assertDefined(result['/b.md'], 'file B exists')
  assertDefined(result['/c.md'], 'file C exists')
}

function testTurboMode() {
  console.log('\n⚡ Turbo Mode')

  const files: Record<string, string> = {
    '/test/turbo.md': `---
title: Turbo
---
## Turbo Section

Turbo content.`,
  }

  const normalResult = parseWithNapi(files, false)
  const turboResult = parseWithNapi(files, true)

  const normalDoc = normalResult['/test/turbo.md'] as ParsedDoc
  const turboDoc = turboResult['/test/turbo.md'] as ParsedDoc

  assertEqual(turboDoc.rawMatter, normalDoc.rawMatter, 'rawMatter matches')
  assertEqual(turboDoc.content, normalDoc.content, 'content matches')
  assertEqual(
    turboDoc.headings.length,
    normalDoc.headings.length,
    'headings count matches',
  )
  assertEqual(turboDoc.plainText, normalDoc.plainText, 'plainText matches')
}

function testEmptyFile() {
  console.log('\n📄 Empty File')

  const files: Record<string, string> = { '/test/empty.md': '' }
  const result = parseWithNapi(files, false)
  const doc = result['/test/empty.md'] as ParsedDoc

  assertDefined(doc, 'doc is defined')
  assertEqual(doc.rawMatter, '', 'rawMatter is empty')
  assertEqual(doc.content, '', 'content is empty')
  assertEqual(doc.headings.length, 0, 'no headings')
  assertEqual(doc.plainText, '', 'plainText is empty')
}

function testComplexFrontmatter() {
  console.log('\n🔧 Complex Frontmatter')

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

  const files: Record<string, string> = { '/test/complex.md': content }
  const result = parseWithNapi(files, false)
  const doc = result['/test/complex.md'] as ParsedDoc

  assertDefined(doc, 'doc is defined')
  assertContains(doc.rawMatter, 'zig', 'rawMatter contains tags.zig')
  assertContains(doc.rawMatter, 'docs', 'rawMatter contains tags.docs')
  assertContains(doc.rawMatter, 'Jesus', 'rawMatter contains author')
}

function testE2eRealFiles() {
  console.log('\n📁 E2E: Real MDX Files')

  const files: Record<string, string> = {
    '/e2e/index.md': `---
title: Home
description: Welcome page
---
# Welcome

## Getting Started

Welcome to the docs!

## Features

- Fast
- Reliable`,
    '/e2e/guides/start.md': `---
title: Getting Started
sidebarPosition: 1
---
## Installation

Run the command.

## Configuration

Configure settings.`,
    '/e2e/api.md': `---
title: API
tags:
  - api
---
## Endpoints

### GET /users

Returns all users.

### POST /users

Creates a new user.`,
  }

  const result = parseWithNapi(files, false)
  assertEqual(Object.keys(result).length, 3, 'result has 3 files')

  // Index
  const indexDoc = result['/e2e/index.md'] as ParsedDoc
  assertDefined(indexDoc, 'index doc exists')
  assertContains(
    indexDoc.rawMatter,
    'title: Home',
    'index has title frontmatter',
  )
  assertContains(
    indexDoc.content,
    '## Getting Started',
    'index has Getting Started',
  )

  // Guide
  const guideDoc = result['/e2e/guides/start.md'] as ParsedDoc
  assertDefined(guideDoc, 'guide doc exists')
  assertContains(
    guideDoc.rawMatter,
    'sidebarPosition: 1',
    'guide has sidebarPosition',
  )
  assertEqual(guideDoc.headings.length, 2, 'guide has 2 headings')
  assertEqual(
    guideDoc.headings[0].text,
    'Installation',
    'first heading is Installation',
  )

  // API
  const apiDoc = result['/e2e/api.md'] as ParsedDoc
  assertDefined(apiDoc, 'api doc exists')
  assertContains(apiDoc.rawMatter, 'api', 'api has tags')
  const apiHeadings = apiDoc.headings.map((h) => h.text)
  assert(apiHeadings.includes('Endpoints'), 'api has Endpoints heading')
  assert(apiHeadings.includes('GET /users'), 'api has GET /users heading')
  assert(apiHeadings.includes('POST /users'), 'api has POST /users heading')
}

function testTurmoModeConsistency() {
  console.log('\n⚡ Turbo Mode Consistency')

  const files: Record<string, string> = {
    '/e2e/index.md': `---
title: Home
description: Welcome page
---
## Getting Started

Content.`,
    '/e2e/api.md': `---
title: API
tags:
  - api
---
## Endpoints

### GET /users

Content.`,
  }

  const normalResult = parseWithNapi(files, false)
  const turboResult = parseWithNapi(files, true)

  for (const key of Object.keys(normalResult)) {
    const normalDoc = normalResult[key] as ParsedDoc
    const turboDoc = turboResult[key] as ParsedDoc
    assertEqual(
      turboDoc.rawMatter,
      normalDoc.rawMatter,
      `[${key}] rawMatter matches`,
    )
    assertEqual(turboDoc.content, normalDoc.content, `[${key}] content matches`)
    assertEqual(
      turboDoc.headings.length,
      normalDoc.headings.length,
      `[${key}] headings count matches`,
    )
    assertEqual(
      turboDoc.plainText,
      normalDoc.plainText,
      `[${key}] plainText matches`,
    )
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('🔬 N-API Binding Tests')
  console.log('='.repeat(50))

  if (!testNapiBindingAvailability()) {
    process.exit(0) // Not a failure, just no library
  }

  testSingleFileWithFrontmatter()
  testFileWithoutFrontmatter()
  testMultipleFiles()
  testTurboMode()
  testEmptyFile()
  testComplexFrontmatter()
  testE2eRealFiles()
  testTurmoModeConsistency()

  console.log('\n' + '='.repeat(50))
  console.log(`📊 Results: ${passed} passed, ${failed} failed`)

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Test suite crashed:', err)
  process.exit(1)
})
