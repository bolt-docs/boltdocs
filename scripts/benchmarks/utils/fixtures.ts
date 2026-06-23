import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

export interface FixtureOptions {
  fileCount: number
  contentComplexity: 'simple' | 'medium' | 'complex'
  includeCodeBlocks: boolean
  includeTables: boolean
  includeHtml: boolean
  includeMdxComponents: boolean
}

const DEFAULT_OPTIONS: FixtureOptions = {
  fileCount: 100,
  contentComplexity: 'medium',
  includeCodeBlocks: true,
  includeTables: true,
  includeHtml: true,
  includeMdxComponents: false,
}

export function createFixtureDir(
  options: Partial<FixtureOptions> = {},
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-bench-'))

  for (let i = 1; i <= opts.fileCount; i++) {
    const content = generateMarkdown(i, opts)
    fs.writeFileSync(path.join(dir, `page-${i}.md`), content)
  }

  const layoutDir = path.join(dir, 'docs')
  fs.mkdirSync(layoutDir, { recursive: true })
  fs.writeFileSync(
    path.join(layoutDir, 'layout.tsx'),
    `import { DocsLayout } from 'boltdocs/client'
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DocsLayout>{children}</DocsLayout>
}`,
  )

  return dir
}

export function createMdxFixtureDir(fileCount: number): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-bench-mdx-'))

  for (let i = 1; i <= fileCount; i++) {
    const content = generateMdxContent(i)
    fs.writeFileSync(path.join(dir, `component-${i}.mdx`), content)
  }

  return dir
}

export function cleanupFixtureDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

function generateMarkdown(index: number, opts: FixtureOptions): string {
  const parts: string[] = []

  parts.push(`---
title: Benchmark Page ${index}
sidebar_position: ${index}
description: Generated benchmark page ${index}
---

# Page ${index}

This is benchmark page ${index} with ${opts.contentComplexity} complexity.

## Section A

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

- Item one with **bold text**
- Item two with *italic text*
- Item three with \`inline code\`
- Item four with [a link](https://example.com)
- Item five with ~~strikethrough~~`)

  if (opts.includeCodeBlocks) {
    parts.push(`
### Code Example

\`\`\`typescript
interface BenchPage {
  id: number
  title: string
  complexity: '${opts.contentComplexity}'
}

function getPage_${index}(): BenchPage {
  return {
    id: ${index},
    title: 'Benchmark Page ${index}',
    complexity: '${opts.contentComplexity}',
  }
}

const page = getPage_${index}()
console.log(page)
\`\`\`

\`\`\`javascript
const items = [1, 2, 3, 4, 5].map(n => n * ${index})
const result = items.reduce((acc, val) => acc + val, 0)
export default result
\`\`\`

\`\`\`css
.benchmark-page-${index} {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1rem;
  padding: 2rem;
}
\`\`\``)
  }

  if (opts.includeTables) {
    parts.push(`
### Data Table

| Feature | Status | Priority | Notes |
|---------|--------|----------|-------|
| Feature A | Active | High | Page ${index} |
| Feature B | Pending | Medium | Generated |
| Feature C | Draft | Low | Benchmark |
| Feature D | Active | High | Test data |
| Feature E | Active | Medium | Page ${index} |`)
  }

  if (opts.includeHtml) {
    parts.push(`
### HTML Block

<div class="callout callout-info">
  <strong>Note:</strong> This is an HTML block in page ${index}.
  <p>It contains multiple paragraphs and <em>formatted text</em>.</p>
</div>

<details>
  <summary>Expand for details</summary>
  <p>Hidden content for page ${index} with additional information.</p>
</details>`)
  }

  parts.push(`
## Section B

> This is a blockquote in page ${index}. It contains wisdom about benchmarking.

More paragraph text to increase content size. The quick brown fox jumps over the lazy dog.
This sentence contains all letters of the alphabet for testing purposes.

- Nested item A
  - Sub-item A1
  - Sub-item A2
- Nested item B
  - Sub-item B1
    - Deep nested item

## Section C

Final section of page ${index} with concluding remarks.

1. First ordered item
2. Second ordered item
3. Third ordered item
4. Fourth ordered item
5. Fifth ordered item`)

  return parts.join('\n')
}

function generateMdxContent(index: number): string {
  return `---
title: MDX Component ${index}
description: Test MDX component ${index}
---

# MDX Component ${index}

This MDX file tests component rendering performance.

## Dynamic Content

The current page index is **${index}**.

import { useState } from 'react'

export function Counter_${index}() {
  const [count, setCount] = useState(0)
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
    </div>
  )
}

## JSX Elements

<div className="grid grid-cols-2 gap-4">
  <div className="p-4 border rounded">
    <h3>Card ${index}A</h3>
    <p>First card content</p>
  </div>
  <div className="p-4 border rounded">
    <h3>Card ${index}B</h3>
    <p>Second card content</p>
  </div>
</div>

## Code with MDX

\`\`\`tsx
// Component ${index}
export const Component_${index} = () => {
  return <div>Hello from component ${index}</div>
}
\`\`\`

## Mixed Content

This paragraph has **bold**, *italic*, and \`code\` inline.

| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Cell ${index}.1 | Cell ${index}.2 | Cell ${index}.3 |
| Cell ${index}.4 | Cell ${index}.5 | Cell ${index}.6 |`
}
