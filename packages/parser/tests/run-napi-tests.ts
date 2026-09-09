#!/usr/bin/env node
/**
 * N-API binding standalone test runner.
 * Run with: tsx tests/run-napi-tests.ts
 * Requires: libbdocs_parser_napi.so to be built (pnpm build:napi)
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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
  assert(
    actual === expected,
    `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  )
}

function assertContains(actual: string, expected: string, message: string) {
  assert(
    actual.includes(expected),
    `${message}: expected content to contain ${JSON.stringify(expected)}`,
  )
}

function normalized(filePath: string) {
  return path.resolve(filePath).replace(/\\/g, '/')
}

function createDocs(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bdocs-napi-runner-'))
  for (const [relativePath, content] of Object.entries(files)) {
    const filePath = path.join(root, relativePath)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content)
  }
  return root
}

function testSingleFile() {
  console.log('\n📄 Directory with frontmatter')
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
    const doc = parseWithNapi(root, false)[
      normalized(path.join(root, 'doc.md'))
    ] as ParsedDoc
    assert(doc !== undefined, 'doc is defined')
    assertContains(doc.rawMatter, 'title: Test Doc', 'rawMatter contains title')
    assertContains(doc.content, '# Hello World', 'content contains heading')
    assertContains(doc.plainText, 'Hello World', 'plainText contains title')
    assert(
      doc.headings.some((heading) => heading.text === 'Section 1'),
      'heading contains Section 1',
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

function testDiscovery() {
  console.log('\n📚 Recursive discovery')
  const root = createDocs({
    'a.md': '## File A',
    'nested/b.mdx': '## File B',
    '_private/ignored.md': '## Ignored',
  })

  try {
    const result = parseWithNapi(root, false)
    assertEqual(
      Object.keys(result).length,
      2,
      'result has two public documents',
    )
    assert(
      result[normalized(path.join(root, 'a.md'))] !== undefined,
      'file A exists',
    )
    assert(
      result[normalized(path.join(root, 'nested/b.mdx'))] !== undefined,
      'file B exists',
    )
    assert(
      result[normalized(path.join(root, '_private/ignored.md'))] === undefined,
      'private file is ignored',
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

function testTurboConsistency() {
  console.log('\n⚡ Turbo consistency')
  const root = createDocs({
    'turbo.md': `---
title: Turbo
---
## Turbo Section

Turbo content.`,
  })

  try {
    const key = normalized(path.join(root, 'turbo.md'))
    const normal = parseWithNapi(root, false)[key] as ParsedDoc
    const turbo = parseWithNapi(root, true)[key] as ParsedDoc
    assertEqual(turbo.rawMatter, normal.rawMatter, 'rawMatter matches')
    assertEqual(turbo.content, normal.content, 'content matches')
    assertEqual(turbo.plainText, normal.plainText, 'plainText matches')
    assertEqual(
      turbo.headings.length,
      normal.headings.length,
      'heading count matches',
    )
    assertEqual(turbo.description, normal.description, 'description matches')
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

function testEmptyDirectory() {
  console.log('\n📁 Empty directory')
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bdocs-napi-empty-'))
  try {
    assertEqual(
      Object.keys(parseWithNapi(root, false)).length,
      0,
      'empty directory returns no documents',
    )
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

console.log('🔬 N-API Binding Tests')
console.log('='.repeat(50))

if (!tryLoadNapi()) {
  console.log('⚠️  N-API shared library not found. Run `pnpm build:napi` first.')
  process.exit(0)
}

testSingleFile()
testDiscovery()
testTurboConsistency()
testEmptyDirectory()

console.log('\n' + '='.repeat(50))
console.log(`📊 Results: ${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
