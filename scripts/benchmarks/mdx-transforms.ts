import { Bench } from 'tinybench'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import type { BenchmarkConfig, SuiteResult } from './utils/types'
import { collectSuiteResult } from './utils/types'

const MDX_CONTENT_SAMPLES = [
  `---
title: Simple Component
---

# Simple

Just a paragraph with **bold** and *italic*.
`,

  `---
title: Code Example
---

# Code

\`\`\`typescript
const x: number = 42
function add(a: number, b: number): number {
  return a + b
}
\`\`\`

Inline \`code\` here.
`,

  `---
title: Table Page
---

# Tables

| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
| 4 | 5 | 6 |

And a list:

- Item 1
- Item 2
- Item 3
`,

  `---
title: Complex Page
---

# Complex

import { useState } from 'react'

export function Comp() {
  const [count, setCount] = useState(0)
  return <div>{count}</div>
}

<Callout type="info">
  This is an MDX component.
</Callout>

\`\`\`tsx
<Comp />
\`\`\`

| Feature | Status |
|---------|--------|
| Ready | Yes |
`,

  `---
title: Nested Content
---

# Nested

<div className="custom">
  <section>
    <h2>Title</h2>
    <p>Paragraph with **bold**.</p>
  </section>
</div>

> Blockquote with \`code\`

- List item
  - Nested item
    - Deep nested
`,
]

function generateBatchMdxFixture(fileCount: number): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-mdx-bench-'))
  for (let i = 0; i < fileCount; i++) {
    const sample = MDX_CONTENT_SAMPLES[i % MDX_CONTENT_SAMPLES.length]
    const content = sample.replace('# ', `# Page ${i} - `)
    fs.writeFileSync(path.join(dir, `page-${i}.mdx`), content)
  }
  return dir
}

export async function runMdxTransformSuite(
  config: BenchmarkConfig,
): Promise<SuiteResult> {
  const dir = generateBatchMdxFixture(100)

  try {
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mdx'))

    const bench = new Bench({
      name: 'MDX Transforms',
      time: config.time,
      iterations: config.iterations,
      warmupIterations: config.warmupIterations,
      warmupTime: config.warmupTime,
    })

    bench.add('frontmatter extraction (100 files)', () => {
      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8')
        content.match(/^---\n([\s\S]*?)\n---/)
      }
    })

    bench.add('heading extraction (100 files)', () => {
      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8')
        const headings: string[] = []
        const regex = /^#{1,6}\s+(.+)$/gm
        let match
        while ((match = regex.exec(content)) !== null) {
          headings.push(match[1].trim())
        }
        headings
      }
    })

    bench.add('link extraction (100 files)', () => {
      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8')
        const links: string[] = []
        const regex = /\[([^\]]+)\]\(([^)]+)\)/g
        let match
        while ((match = regex.exec(content)) !== null) {
          links.push(match[2])
        }
        links
      }
    })

    bench.add('code block extraction (100 files)', () => {
      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8')
        const blocks: { lang: string; code: string }[] = []
        const regex = /```(\w+)?\n([\s\S]*?)```/g
        let match
        while ((match = regex.exec(content)) !== null) {
          blocks.push({ lang: match[1] || 'text', code: match[2] })
        }
        blocks
      }
    })

    bench.add('content slug generation (100 files)', () => {
      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8')
        const slugRegex = /^#{1,6}\s+(.+)$/gm
        let match
        while ((match = slugRegex.exec(content)) !== null) {
          match[1]
            .trim()
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
        }
      }
    })

    bench.add('full MDX parse pipeline (100 files)', () => {
      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8')

        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
        const body = fmMatch ? content.slice(fmMatch[0].length).trim() : content

        const headings: string[] = []
        const hRegex = /^#{1,6}\s+(.+)$/gm
        let hMatch
        while ((hMatch = hRegex.exec(body)) !== null) {
          headings.push(hMatch[1].trim())
        }

        const links: string[] = []
        const lRegex = /\[([^\]]+)\]\(([^)]+)\)/g
        let lMatch
        while ((lMatch = lRegex.exec(body)) !== null) {
          links.push(lMatch[2])
        }

        const codeBlocks: string[] = []
        const cRegex = /```(\w+)?\n([\s\S]*?)```/g
        let cMatch
        while ((cMatch = cRegex.exec(body)) !== null) {
          codeBlocks.push(cMatch[2])
        }

        const wordCount = body.split(/\s+/).length
        const charCount = body.length
        void headings
        void links
        void codeBlocks
        void wordCount
        void charCount
      }
    })

    bench.add('MD5 content hash (100 files)', () => {
      const crypto = require('node:crypto')
      for (const file of files) {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8')
        crypto.createHash('md5').update(content).digest('hex')
      }
    })

    const start = performance.now()
    await bench.run()
    const duration = performance.now() - start

    return collectSuiteResult('MDX Transforms', bench, duration)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}
