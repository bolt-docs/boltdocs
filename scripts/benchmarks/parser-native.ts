import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { performance } from 'node:perf_hooks'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..')

const { generateRoutes, invalidateRouteCache } = await import(
  path.join(WORKSPACE_ROOT, 'packages', 'core', 'dist', 'node', 'index.mjs')
)

type ParserType = 'JS' | 'WASM' | 'Native'

type GenerateRoutesResult = {
  path: string
}

type GenerateRoutesFn = (
  docsDir: string,
  options?: unknown,
  basePath?: string,
  preserve?: boolean,
) => Promise<GenerateRoutesResult[]>

type InvalidateRouteCacheFn = () => void

const typedGenerateRoutes = generateRoutes as unknown as GenerateRoutesFn
const typedInvalidateRouteCache =
  invalidateRouteCache as unknown as InvalidateRouteCacheFn

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Create a varied MDX file content generator
function generateVariedMDX(index: number): string {
  const headings = [
    `## Heading 2 - Section ${index}`,
    `### Heading 3 - Subsection ${index} with code \`inlineCode\``,
    `#### Heading 4 - Detail ${index} with HTML <span>tag</span>`,
  ]

  const paragraphs = [
    `This is a paragraph for document ${index}. It contains some **bold text**, *italic text*, and inline \`code\` examples to test markdown parsing.`,
    `Here is a code block to ensure the parser skips code content when extracting headings:
\`\`\`typescript
function testFunc() {
  console.log("Heading inside string shouldn't be parsed: ## Not A Heading")
  return { value: 42 }
}
\`\`\`
`,
    `And here is some HTML markup to verify sanitization: <div class="alert alert-info">Some info text</div>. Let's make sure it handles links cleanly like [Boltdocs website](https://boltdocs.vercel.app).`,
  ]

  const table = `| Column A | Column B | Column C |
| --- | --- | --- |
| ${index} | **bold** | _italic_ |
| \`code\` | [example](https://example.com) | <strong>HTML</strong> |`

  const nestedList = `- Parent item ${index}
  - Child item A
    - Grandchild item
  - Child item B`

  const htmlBlock = `<aside class="note">This is an HTML block rendered as raw markup within the page.</aside>`

  return `---
intermediateTitle: "Varied Document ${index}"
title: Varied Document ${index}
description: This is a generated description for varied document number ${index} to test parsing speed.
category: Benchmark
tags:
  - benchmark
  - performance
  - mdx
related:
  - label: "Benchmark"
    link: "/docs/benchmark"
order: ${index}
author: Benchmark Bot
complexity: ${index % 3 === 0 ? 'high' : 'medium'}
---

# Document ${index} Title

${paragraphs[0]}

${headings[0]}

${nestedList}

${paragraphs[1]}

${htmlBlock}

${headings[1]}

${table}

${paragraphs[2]}

> This blockquote is part of the document content and should be preserved.

\`\`\`tsx
type Example = {
  id: number
  title: string
}
const example: Example = {
  id: ${index},
  title: 'Document ${index}',
}
\`\`\`

${headings[2]}

${paragraphs[0]}
`
}

// Generate doc files inside target dir
function generateFiles(targetDir: string, count: number): void {
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true })
  }
  fs.mkdirSync(targetDir, { recursive: true })

  for (let i = 1; i <= count; i += 1) {
    const filePath = path.join(targetDir, `bench_doc_${i}.mdx`)
    fs.writeFileSync(filePath, generateVariedMDX(i), 'utf8')
  }
}

// Run benchmark for a specific parser type
async function runBench(
  docsDir: string,
  type: ParserType,
): Promise<{ time: number; routesCount: number }> {
  // Clear routing caches
  typedInvalidateRouteCache()

  // Clear filesystem persistence cache (important so that we benchmark the full parse speed, not disk cache!)
  const cacheDir = path.resolve(docsDir, '../.boltdocs/cache')
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true })
  }

  // Setup environment variables
  if (type === 'JS') {
    process.env.VITEST = 'true'
    process.env.FORCE_WASM = ''
  } else if (type === 'Native') {
    process.env.VITEST = ''
    process.env.FORCE_WASM = ''
  } else if (type === 'WASM') {
    process.env.VITEST = ''
    process.env.FORCE_WASM = 'true'
  }

  const start = performance.now()
  const routes = await typedGenerateRoutes(docsDir, undefined, '/docs', true)
  const time = performance.now() - start

  return {
    time,
    routesCount: routes.length,
  }
}

async function main() {
  const benchDir = path.resolve(__dirname, 'temp_bench_docs')

  console.log('==================================================')
  console.log('      Boltdocs Speed Benchmark Runner            ')
  console.log('==================================================\n')

  const fileCounts = [100, 500, 1000, 2000, 5000, 10000]
  const results: Record<number, { JS: number; WASM: number; Native: number }> =
    {}

  for (const count of fileCounts) {
    console.log(`Generating ${count} varied MDX files...`)
    generateFiles(benchDir, count)

    results[count] = { JS: 0, WASM: 0, Native: 0 }

    // 1. Run JS Benchmark
    console.log(`Running JS parser benchmark on ${count} files...`)
    const jsResult = await runBench(benchDir, 'JS')
    results[count].JS = jsResult.time
    console.log(`-> JS parser took: ${jsResult.time.toFixed(2)}ms`)

    // 2. Run WASM Benchmark
    console.log(`Running WASM parser benchmark on ${count} files...`)
    const wasmResult = await runBench(benchDir, 'WASM')
    results[count].WASM = wasmResult.time
    console.log(`-> WASM parser took: ${wasmResult.time.toFixed(2)}ms`)

    // 3. Run Native Benchmark
    console.log(`Running Native parser benchmark on ${count} files...`)
    const nativeResult = await runBench(benchDir, 'Native')
    results[count].Native = nativeResult.time
    console.log(`-> Native parser took: ${nativeResult.time.toFixed(2)}ms`)

    console.log(`--- Done with ${count} files ---\n`)
  }

  // Cleanup temp files
  console.log('Cleaning up temporary benchmark files...')
  if (fs.existsSync(benchDir)) {
    fs.rmSync(benchDir, { recursive: true, force: true })
  }

  console.log('\n==================================================')
  console.log('              Benchmark Summary                  ')
  console.log('==================================================')
  console.log(
    'File Count | JS Parser  | WASM Parser | Native Parser | Speedup (Native vs JS)',
  )
  console.log(
    '-----------|------------|-------------|---------------|-----------------------',
  )

  for (const count of fileCounts) {
    const result = results[count]
    const js = result.JS
    const wasm = result.WASM
    const native = result.Native
    const speedup = (js / native).toFixed(1)

    const pad = (val: string, len: number): string =>
      String(val).padEnd(len, ' ')

    console.log(
      `${pad(count, 10)} | ${pad(js.toFixed(2) + 'ms', 10)} | ${pad(wasm.toFixed(2) + 'ms', 11)} | ${pad(native.toFixed(2) + 'ms', 13)} | ${speedup}x faster`,
    )
  }
  console.log('==================================================\n')
}

main().catch(console.error)
