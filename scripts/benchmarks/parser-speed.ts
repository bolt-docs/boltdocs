import { Bench } from 'tinybench'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { BenchmarkConfig, SuiteResult } from './utils/types'
import { collectSuiteResult } from './utils/types'

function generateParserFiles(count: number): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-parser-bench-'))

  for (let i = 1; i <= count; i++) {
    const content = `---
title: Parser Test ${i}
description: Test document ${i} for parser benchmarking
sidebar_position: ${i}
tags:
  - benchmark
  - parser
  - performance
order: ${i}
author: Benchmark Bot
---

# Document ${i}

This is a test document for parser benchmarking with **bold text**, *italic text*, and \`inline code\`.

## Section A

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

- Item ${i}.1 with [link](https://example.com)
- Item ${i}.2 with \`code\`
- Item ${i}.3 with **bold**

> This is blockquote number ${i}.

\`\`\`typescript
function test_${i}() {
  console.log("Document ${i}")
  return { id: ${i}, active: true }
}
\`\`\`

## Section B

| Column A | Column B | Column C |
|----------|----------|----------|
| ${i} | **bold** | _italic_ |
| \`code\` | [link](https://example.com) | text |

<div class="note">
  HTML block in document ${i}.
</div>

### Nested List

- Parent ${i}
  - Child A
    - Grandchild
  - Child B

## Section C

Final paragraph for document ${i}.

1. First item
2. Second item
3. Third item`
    fs.writeFileSync(path.join(dir, `test_${i}.mdx`), content)
  }

  return dir
}

function countHeadings(
  content: string,
): { level: number; text: string; id: string }[] {
  const headings: { level: number; text: string; id: string }[] = []
  const regex = /^(#{1,6})\s+(.+)$/gm
  let match
  while ((match = regex.exec(content)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2].trim(),
      id: match[2].trim().toLowerCase().replace(/\s+/g, '-'),
    })
  }
  return headings
}

function extractFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return {}
  const fm: Record<string, any> = {}
  const lines = match[1].split('\n')
  let currentKey = ''
  for (const line of lines) {
    if (line.includes(':')) {
      const [key, ...rest] = line.split(':')
      currentKey = key.trim()
      fm[currentKey] = rest.join(':').trim()
    } else if (currentKey && (line.startsWith('  -') || line.startsWith('-'))) {
      const val = line.replace(/^\s*-\s*/, '').trim()
      if (!Array.isArray(fm[currentKey])) fm[currentKey] = []
      fm[currentKey].push(val)
    }
  }
  return fm
}

export async function runParserSuite(
  config: BenchmarkConfig,
): Promise<SuiteResult> {
  const dir100 = generateParserFiles(100)
  const dir500 = generateParserFiles(500)

  try {
    const files100 = fs.readdirSync(dir100).filter((f) => f.endsWith('.mdx'))
    const files500 = fs.readdirSync(dir500).filter((f) => f.endsWith('.mdx'))

    const bench = new Bench({
      name: 'Parser',
      time: config.time,
      iterations: config.iterations,
      warmupIterations: config.warmupIterations,
      warmupTime: config.warmupTime,
    })

    bench.add('readFile 100 files', () => {
      for (const file of files100) {
        fs.readFileSync(path.join(dir100, file), 'utf-8')
      }
    })

    bench.add('readFile 500 files', () => {
      for (const file of files500) {
        fs.readFileSync(path.join(dir500, file), 'utf-8')
      }
    })

    bench.add('extractFrontmatter (100 files)', () => {
      for (const file of files100) {
        const content = fs.readFileSync(path.join(dir100, file), 'utf-8')
        extractFrontmatter(content)
      }
    })

    bench.add('countHeadings (100 files)', () => {
      for (const file of files100) {
        const content = fs.readFileSync(path.join(dir100, file), 'utf-8')
        countHeadings(content)
      }
    })

    bench.add('parse + extract (100 files)', () => {
      for (const file of files100) {
        const content = fs.readFileSync(path.join(dir100, file), 'utf-8')
        extractFrontmatter(content)
        countHeadings(content)
      }
    })

    bench.add('parse + extract (500 files)', () => {
      for (const file of files500) {
        const content = fs.readFileSync(path.join(dir500, file), 'utf-8')
        extractFrontmatter(content)
        countHeadings(content)
      }
    })

    bench.add('frontmatter YAML parse (100 files)', () => {
      for (const file of files100) {
        const content = fs.readFileSync(path.join(dir100, file), 'utf-8')
        const match = content.match(/^---\n([\s\S]*?)\n---/)
        if (match) {
          const lines = match[1].split('\n')
          const parsed: Record<string, any> = {}
          for (const line of lines) {
            if (line.startsWith('-') || line.startsWith('  -')) continue
            const colonIdx = line.indexOf(':')
            if (colonIdx > 0) {
              const key = line.slice(0, colonIdx).trim()
              const val = line.slice(colonIdx + 1).trim()
              parsed[key] = val
            }
          }
          parsed
        }
      }
    })

    const start = performance.now()
    await bench.run()
    const duration = performance.now() - start

    return collectSuiteResult('Parser', bench, duration)
  } finally {
    fs.rmSync(dir100, { recursive: true, force: true })
    fs.rmSync(dir500, { recursive: true, force: true })
  }
}
