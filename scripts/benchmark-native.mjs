import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  generateRoutes,
  invalidateRouteCache,
} from '../packages/core/dist/node/index.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Create a varied MDX file content generator
function generateVariedMDX(index) {
  const headings = [
    `## Heading 2 - Section ${index}`,
    `### Heading 3 - Subsection ${index} with code \`inlineCode\``,
    `#### Heading 4 - Detail ${index} with HTML <span>tag</span>`,
  ]

  const paragraphs = [
    `This is a paragraph for document ${index}. It contains some **bold text** and *italic text* to test markdown parsing.`,
    `Here is a code block to ensure the parser skips code content when extracting headings:
\`\`\`typescript
function testFunc() {
  console.log("Heading inside string shouldn't be parsed: ## Not A Heading");
}
\`\`\`
`,
    `And here is some HTML markup to verify sanitization: <div class="alert alert-info">Some info text</div>. Let's make sure it handles links cleanly like [Boltdocs website](https://boltdocs.vercel.app).`,
  ]

  return `---
title: Varied Document ${index}
description: This is a generated description for varied document number ${index} to test parsing speed.
category: Benchmark
order: ${index}
hidden: false
---

# Document ${index} Title

${paragraphs[index % paragraphs.length]}

${headings[0]}

Some transition text.

${headings[1]}

${paragraphs[(index + 1) % paragraphs.length]}

${headings[2]}

${paragraphs[(index + 2) % paragraphs.length]}
`
}

// Generate doc files inside target dir
function generateFiles(targetDir, count) {
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true })
  }
  fs.mkdirSync(targetDir, { recursive: true })

  for (let i = 1; i <= count; i++) {
    const filePath = path.join(targetDir, `bench_doc_${i}.mdx`)
    fs.writeFileSync(filePath, generateVariedMDX(i), 'utf8')
  }
}

// Run benchmark for a specific parser type
async function runBench(docsDir, count, type) {
  // Clear routing caches
  invalidateRouteCache()

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
  const routes = await generateRoutes(docsDir, undefined, '/docs', true)
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

  const fileCounts = [100, 500, 1000, 2000]
  const results = {}

  for (const count of fileCounts) {
    console.log(`Generating ${count} varied MDX files...`)
    generateFiles(benchDir, count)

    results[count] = {}

    // 1. Run JS Benchmark
    console.log(`Running JS parser benchmark on ${count} files...`)
    const jsResult = await runBench(benchDir, count, 'JS')
    results[count].JS = jsResult.time
    console.log(`-> JS parser took: ${jsResult.time.toFixed(2)}ms`)

    // 2. Run WASM Benchmark
    console.log(`Running WASM parser benchmark on ${count} files...`)
    const wasmResult = await runBench(benchDir, count, 'WASM')
    results[count].WASM = wasmResult.time
    console.log(`-> WASM parser took: ${wasmResult.time.toFixed(2)}ms`)

    // 3. Run Native Benchmark
    console.log(`Running Native parser benchmark on ${count} files...`)
    const nativeResult = await runBench(benchDir, count, 'Native')
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
    const js = results[count].JS
    const wasm = results[count].WASM
    const native = results[count].Native
    const speedup = (js / native).toFixed(1)

    const pad = (val, len) => String(val).padEnd(len, ' ')

    console.log(
      `${pad(count, 10)} | ${pad(js.toFixed(2) + 'ms', 10)} | ${pad(wasm.toFixed(2) + 'ms', 11)} | ${pad(native.toFixed(2) + 'ms', 13)} | ${speedup}x faster`,
    )
  }
  console.log('==================================================\n')
}

main().catch(console.error)
