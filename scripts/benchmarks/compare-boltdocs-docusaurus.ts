import fs from 'node:fs'
import path from 'node:path'
import child_process from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const WORKSPACE_ROOT = path.resolve(__dirname, '..', '..')
const TEMP_ROOT = path.resolve(WORKSPACE_ROOT, '.benchmark-temp')
const BOLTDOCS_DIR = path.resolve(TEMP_ROOT, 'boltdocs')
const DOCUSAURUS_DIR = path.resolve(TEMP_ROOT, 'docusaurus')
const args = process.argv.slice(2)
function getArgValue(flag: string): string | null {
  const index = args.indexOf(flag)
  return index !== -1 && args[index + 1] ? args[index + 1] : null
}
const pagesArg = getArgValue('--pages')
const requestedPageCount = Number(pagesArg ?? process.env.PAGE_COUNT ?? 100)
const PAGE_COUNT =
  Number.isInteger(requestedPageCount) && requestedPageCount > 0
    ? requestedPageCount
    : 100
const IS_COMPLEX =
  args.includes('--complex') || process.env.COMPLEX_MDX === 'true'
const IS_QUICK = args.includes('--quick')
const requestedRuns = Number(
  getArgValue('--runs') ?? process.env.BENCHMARK_RUNS ?? 3,
)
const RUNS =
  Number.isInteger(requestedRuns) && requestedRuns > 0 ? requestedRuns : 3
const EDITED_PAGE_NUMBER = Math.max(1, Math.min(50, PAGE_COUNT))

type TimedSamples = {
  samples: number[]
  min: number
  max: number
  mean: number
  median: number
}

type OutputInventory = {
  files: number
  bytes: number
  htmlFiles: number
  documentRoutes: string[]
}

function summarizeSamples(values: number[]): TimedSamples {
  const samples = [...values].sort((a, b) => a - b)
  const total = samples.reduce((sum, value) => sum + value, 0)
  const middle = Math.floor(samples.length / 2)
  return {
    samples,
    min: samples[0] ?? 0,
    max: samples[samples.length - 1] ?? 0,
    mean: samples.length > 0 ? total / samples.length : 0,
    median:
      samples.length === 0
        ? 0
        : samples.length % 2 === 1
          ? samples[middle]
          : (samples[middle - 1] + samples[middle]) / 2,
  }
}

// Pack local boltdocs packages into tarballs so the sandbox can use them
function packLocalBoltdocs(): string {
  const packDir = path.join(TEMP_ROOT, 'local-pack')
  if (!fs.existsSync(packDir)) {
    fs.mkdirSync(packDir, { recursive: true })
  }

  // Pack core + ssg + processor-satteri + unist-utils
  const packages = [
    { dir: 'packages/core', name: 'boltdocs' },
    { dir: 'packages/plugin-ssg', name: '@bdocs-ssg' },
    { dir: 'packages/processor-satteri', name: '@bdocs-processor-satteri' },
    { dir: 'packages/unist-utils', name: '@bdocs-unist-utils' },
  ]

  let boltdocsTgz = ''
  for (const pkg of packages) {
    const pkgDir = path.join(WORKSPACE_ROOT, pkg.dir)
    console.log(`  Packing ${pkg.name} from ${pkg.dir}...`)
    try {
      const result = child_process.execSync(
        'pnpm pack --pack-destination ' + packDir,
        {
          cwd: pkgDir,
          encoding: 'utf-8',
        },
      )
      const tgzName = result.trim().split('\n').pop()?.trim() || ''
      if (tgzName && tgzName.endsWith('.tgz')) {
        if (pkg.name === 'boltdocs') {
          boltdocsTgz = path.isAbsolute(tgzName)
            ? tgzName
            : path.join(packDir, tgzName)
        }
        console.log(
          `    → ${path.isAbsolute(tgzName) ? tgzName : path.join(packDir, tgzName)}`,
        )
      }
    } catch {
      console.error(`    Failed to pack ${pkg.name}`)
    }
  }

  // Fallback: look for any boltdocs tgz in the pack dir
  if (!boltdocsTgz || !fs.existsSync(boltdocsTgz)) {
    const files = fs
      .readdirSync(packDir)
      .filter((f) => f.startsWith('boltdocs') && f.endsWith('.tgz'))
    if (files.length > 0) {
      boltdocsTgz = path.join(packDir, files[0])
    }
  }

  return boltdocsTgz
}

// Helper to calculate directory size recursively in bytes
function getDirSize(dirPath: string): number {
  let size = 0
  if (!fs.existsSync(dirPath)) return 0
  const files = fs.readdirSync(dirPath)
  for (const file of files) {
    const filePath = path.join(dirPath, file)
    const stats = fs.statSync(filePath)
    if (stats.isDirectory()) {
      size += getDirSize(filePath)
    } else {
      size += stats.size
    }
  }
  return size
}
function getOutputInventory(
  dirPath: string,
  relativePrefix = '',
): OutputInventory {
  let files = 0
  let bytes = 0
  let htmlFiles = 0
  const documentRoutes = new Set<string>()
  if (!fs.existsSync(dirPath)) {
    return { files, bytes, htmlFiles, documentRoutes: [] }
  }

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const filePath = path.join(dirPath, entry.name)
    const relative = relativePrefix
      ? `${relativePrefix}/${entry.name}`
      : entry.name
    if (entry.isDirectory()) {
      const nested = getOutputInventory(filePath, relative)
      files += nested.files
      bytes += nested.bytes
      htmlFiles += nested.htmlFiles
      for (const route of nested.documentRoutes) documentRoutes.add(route)
    } else if (entry.isFile()) {
      files++
      bytes += fs.statSync(filePath).size
      if (!entry.name.endsWith('.html')) continue
      htmlFiles++

      if (relative === '404.html' || relative.endsWith('/404.html')) continue

      const route =
        relative === 'index.html'
          ? '/'
          : relative.endsWith('/index.html')
            ? `/${relative.slice(0, -'/index.html'.length)}`
            : `/${relative.slice(0, -'.html'.length)}`
      documentRoutes.add(route)
    }
  }

  return {
    files,
    bytes,
    htmlFiles,
    documentRoutes: [...documentRoutes].sort(),
  }
}

// Clean and create directories
function setupSandbox() {
  console.log(`Cleaning sandbox at: ${TEMP_ROOT}`)
  if (fs.existsSync(TEMP_ROOT)) {
    fs.rmSync(TEMP_ROOT, { recursive: true, force: true })
  }
  fs.mkdirSync(TEMP_ROOT, { recursive: true })
  fs.mkdirSync(BOLTDOCS_DIR, { recursive: true })
  fs.mkdirSync(DOCUSAURUS_DIR, { recursive: true })
}

// Generate test markdown pages
function generateMarkdownPages() {
  console.log(
    `Generating ${PAGE_COUNT} Markdown pages (Complex Mode: ${IS_COMPLEX})...`,
  )

  const boltdocsDocs = path.join(BOLTDOCS_DIR, 'docs')
  const docusaurusDocs = path.join(DOCUSAURUS_DIR, 'docs')

  if (fs.existsSync(boltdocsDocs))
    fs.rmSync(boltdocsDocs, { recursive: true, force: true })
  if (fs.existsSync(docusaurusDocs))
    fs.rmSync(docusaurusDocs, { recursive: true, force: true })

  fs.mkdirSync(boltdocsDocs, { recursive: true })
  fs.mkdirSync(docusaurusDocs, { recursive: true })

  // Write homepage
  const indexContent = `---
title: Welcome
sidebar_label: Welcome
---
# Welcome

This is the homepage of the benchmarking docs site.
`
  fs.writeFileSync(path.join(boltdocsDocs, 'index.md'), indexContent)
  fs.writeFileSync(path.join(docusaurusDocs, 'index.md'), indexContent)

  // Write pages
  for (let i = 1; i <= PAGE_COUNT; i++) {
    const ext = 'md'
    let content = ''

    if (IS_COMPLEX) {
      content = `---
title: "Hard Benchmark Page ${i} - Architecture & Deep Systems Analysis"
sidebar_label: "Page ${i}"
summary: "Heavy synthetic MDX test page ${i} with multi-language code blocks, tables, math equations, and AST structures."
author: "Antigravity Engineering"
date: "2026-07-28"
sidebar_position: ${i}
---

# Hard Benchmark Page ${i}: Distributed Systems & AST Pipeline Architecture

Welcome to **Page ${i}**. This is an advanced synthetic MDX test page engineered to stress-test MDX compilation, syntax highlighting, AST parsing, and HTML rendering throughput across monorepo engines.

## 1. Executive Summary

- **Target Identifier:** Page-${i}
- **Complexity Tier:** Hard / Multi-Language AST
- **Evaluation Criteria:** Cold Build, Incremental HMR, Worker Pool Distribution

> "High-performance documentation engines must maintain sub-second incremental rebuilds and memory efficiency regardless of document size or AST depth."

---

## 2. Advanced Technical Benchmarks & Data Table

| Feature Set | Specification | Measured Latency | Throughput Limit | Status |
| :--- | :--- | :--- | :--- | :--- |
| Sätteri Precompile | Rust/WASM AST Pipeline | < 1.2 ms/file | > 800 files/sec | **OPTIMIZED** |
| SSG Worker Pool | Piscina Multi-threading | < 15 ms/page | > 60 pages/sec | **ACTIVE** |
| Client Hydration | React 19 Streaming | < 45 ms TTL | 120 FPS | **VERIFIED** |
| MDX AST Parsing | Oxc Parser & Codegen | ~0.8 ms | 1200 ops/sec | **PASSED** |

---

## 3. Polyglot Code Implementation Samples

### 3.1 Rust Engine Architecture
\`\`\`rust
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone)]
pub struct BenchmarkNode<T> {
    pub id: u64,
    pub payload: T,
    pub checksum: String,
}

impl<T> BenchmarkNode<T> {
    pub fn new(id: u64, payload: T) -> Self {
        let checksum = format!("sha256-node-{}-{}", id, std::mem::size_of::<T>());
        Self { id, payload, checksum }
    }

    pub async fn process_async(&self) -> Result<(), String> {
        tokio::time::sleep(tokio::time::Duration::from_micros(50)).await;
        Ok(())
    }
}
\`\`\`

### 3.2 TypeScript / React Integration
\`\`\`tsx
import React, { useState, useEffect, useTransition } from 'react'

export interface PageProps {
  id: number
  title: string
  tags: string[]
}

export const BenchmarkComponent: React.FC<PageProps> = ({ id, title, tags }) => {
  const [isPending, startTransition] = useTransition()
  const [count, setCount] = useState<number>(id * 42)

  useEffect(() => {
    startTransition(() => {
      setCount((prev) => prev + 1)
    })
  }, [id])

  return (
    <div className="benchmark-card border p-4 rounded-lg shadow-md">
      <h3 className="text-xl font-bold">Synthetic Card Page ${i}</h3>
      <p className="text-sm text-gray-500">Node ID: ${i} | State: Active</p>
    </div>
  )
}
\`\`\`

### 3.3 Python Data Science Pipeline
\`\`\`python
import math
import numpy as np

def calculate_benchmark_matrix(size: int = 1000) -> dict:
    matrix = np.random.rand(size, size)
    eigenvalues = np.linalg.eigvals(matrix[:100, :100])
    return {
        "mean": float(np.mean(matrix)),
        "std": float(np.std(matrix)),
        "max_eigen": float(np.max(np.abs(eigenvalues)))
    }

if __name__ == "__main__":
    results = calculate_benchmark_matrix(${i})
    print(f"Page ${i} Benchmark Result: {results}")
\`\`\`

---

## 4. Mathematical Formulations & Theoretical Limits

The theoretical render latency T_render for a documentation site with N pages and W worker threads is modeled by:

T_render(N, W) = T_init + (N / W) * (T_AST + T_React + T_HTML)

Where the Gaussian distribution of AST parsing latency follows:

f(x) = (1 / (sigma * sqrt(2 * pi))) * exp(-0.5 * ((x - mu) / sigma)^2)

---

## 5. Structural Markup & Deep AST Hierarchies

<details>
  <summary>Click to view raw AST Metadata and System Flags for Page ${i}</summary>
  <div className="p-4 bg-gray-900 text-green-400 font-mono text-xs rounded">
    Page metadata node ID: ${i} | Benchmark Tier: Heavy AST
  </div>
</details>

- Item ${i}.1: Core parser initialized
  - Sub-item ${i}.1.1: Tokenizer completed
    - Leaf ${i}.1.1.1: Syntax tree validated
- Item ${i}.2: Virtual module resolved
- Item ${i}.3: Static Site Generation complete
`
    } else {
      content = `---
title: Benchmarking Page ${i}
sidebar_label: Page ${i}
summary: "This generated benchmark page includes headings, code blocks, tables, lists, and HTML markup."
---
# Page ${i}

This is a generated page for benchmarking static site generator speeds.

## Section A
Some random markdown content with formatting.
- **Bold text**
- *Italic text*
- [A Link](https://google.com)

> This is a nested quote inside the page content, and it should remain intact.

### Nested list example
- Item A
  - Item A1
    - Item A1.1
  - Item A2
- Item B

| Feature | Value | Notes |
| --- | --- | --- |
| Page index | ${i} | Generated benchmark content |
| Code sample | yes | Multi-line fenced code |

<div class="benchmark-note">
  <strong>HTML block:</strong> This is a raw HTML section inside the markdown file.
</div>

\`\`\`tsx
interface BenchmarkEntry {
  id: number
  title: string
  isComplex: boolean
}

const entry: BenchmarkEntry = {
  id: ${i},
  title: 'Benchmarking Page ${i}',
  isComplex: true,
}
\`\`\`

## Section B
Some additional paragraph text to increase content size and AST depth.

- [React](https://react.dev)
- [Vite](https://vitejs.dev)
- [Boltdocs](https://boltdocs.vercel.app)
`
    }

    fs.writeFileSync(path.join(boltdocsDocs, `page-${i}.${ext}`), content)
    fs.writeFileSync(path.join(docusaurusDocs, `page-${i}.${ext}`), content)
  }
  console.log(
    `✅ ${PAGE_COUNT} ${IS_COMPLEX ? 'Complex MDX' : 'Standard MD'} pages generated successfully.`,
  )
}

// Set up minimal configuration files
function writeConfigs() {
  console.log('Writing configuration files...')

  // Boltdocs Config
  // Using a plain object export to bypass node_modules resolution issues in sandbox
  const boltdocsConfig = `export default {
  base: '/',
  theme: {
    title: 'Boltdocs Benchmark',
    description: 'A benchmark test suite',
  }
}
`
  fs.writeFileSync(
    path.join(BOLTDOCS_DIR, 'boltdocs.config.ts'),
    boltdocsConfig,
  )
  fs.writeFileSync(path.join(BOLTDOCS_DIR, 'index.css'), '') // empty stylesheet

  // Pack local boltdocs and write sandbox package.json
  const boltdocsTgz = packLocalBoltdocs()
  console.log(
    `Using local boltdocs pack: ${boltdocsTgz || '(not found, will fall back to npm)'}`,
  )

  // Pack ALL workspace dependencies that boltdocs core needs
  const allWorkspaceDeps = [
    { dir: 'packages/core', name: 'boltdocs' },
    { dir: 'packages/plugin-ssg', name: '@bdocs/ssg' },
    { dir: 'packages/parser', name: '@bdocs/parser' },
    { dir: 'packages/unist-utils', name: '@bdocs/unist-utils' },
    { dir: 'packages/zig-critters', name: '@bdocs/zig-critters' },
    { dir: 'packages/processor-satteri', name: '@bdocs/processor-satteri' },
    {
      dir: 'packages/plugin-image-optimizer',
      name: '@bdocs/plugin-image-optimizer',
    },
  ]

  const packDir = path.join(TEMP_ROOT, 'local-pack')
  if (!fs.existsSync(packDir)) {
    fs.mkdirSync(packDir, { recursive: true })
  }

  const depOverrides: Record<string, string> = {
    react: '19.2.5',
    'react-dom': '19.2.5',
    'react-aria-components': '^1.16.0',
  }
  const localWorkspacePackages: Record<string, string> = {}
  const boltdocsPkg: Record<string, unknown> = {
    name: 'benchmark-boltdocs',
    private: true,
    type: 'module',
    dependencies: {
      react: '19.2.5',
      'react-dom': '19.2.5',
      'react-aria-components': '^1.16.0',
    },
  }

  // Pack each workspace dep and collect tarball paths
  for (const wsDep of allWorkspaceDeps) {
    const pkgDir = path.join(WORKSPACE_ROOT, wsDep.dir)
    if (!fs.existsSync(pkgDir)) {
      console.log(`  Skipping ${wsDep.name} (${wsDep.dir} not found)`)
      continue
    }
    console.log(`  Packing ${wsDep.name} from ${wsDep.dir}...`)
    try {
      const result = child_process.execSync(
        'pnpm pack --pack-destination ' + packDir,
        {
          cwd: pkgDir,
          encoding: 'utf-8',
        },
      )
      const lines = result.trim().split('\n').filter(Boolean)
      const tgzName = lines[lines.length - 1]?.trim() || ''
      if (tgzName && tgzName.endsWith('.tgz')) {
        const fullPath = path.isAbsolute(tgzName)
          ? tgzName
          : path.join(packDir, tgzName)
        if (wsDep.name === 'boltdocs') {
          ;(boltdocsPkg.dependencies as Record<string, string>).boltdocs =
            `file:${fullPath}`
        } else {
          const localPackage = `file:${fullPath}`
          localWorkspacePackages[wsDep.name] = localPackage
          depOverrides[wsDep.name] = localPackage
        }
        console.log(`    → ${fullPath}`)
      }
    } catch (err) {
      console.error(`    Failed to pack ${wsDep.name}:`)
    }
  }

  // Declare every packed workspace package directly as a sandbox dependency as
  // well as an override. The direct declarations make the package manager
  // materialize the exact tarball, while overrides ensure Boltdocs' own
  // workspace ranges cannot resolve to stale local links or registry copies.
  Object.assign(
    boltdocsPkg.dependencies as Record<string, string>,
    localWorkspacePackages,
  )
  if (Object.keys(depOverrides).length > 0) {
    boltdocsPkg.pnpm = { overrides: depOverrides }
  }

  // Fallback: if we couldn't pack boltdocs, use npm
  if (!(boltdocsPkg.dependencies as Record<string, string>).boltdocs) {
    ;(boltdocsPkg.dependencies as Record<string, string>).boltdocs = '3.1.0'
    console.log('  Using npm version 3.1.0 as fallback')
  }

  fs.writeFileSync(
    path.join(BOLTDOCS_DIR, 'package.json'),
    JSON.stringify(boltdocsPkg, null, 2),
  )

  // Boltdocs index.html (Required by Vite/SSG)
  const boltdocsHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Boltdocs Benchmark</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`
  fs.writeFileSync(path.join(BOLTDOCS_DIR, 'index.html'), boltdocsHtml)

  // Boltdocs layout.tsx (Mandatory for Boltdocs setup)
  const boltdocsLayout = `import { DocsLayout } from 'boltdocs/client'
import React from 'react'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DocsLayout>{children}</DocsLayout>
}
`
  const boltdocsDocs = path.join(BOLTDOCS_DIR, 'docs')
  fs.writeFileSync(path.join(boltdocsDocs, 'layout.tsx'), boltdocsLayout)

  // Docusaurus package.json (with Docusaurus Faster)
  const docusaurusPkg = {
    name: 'benchmark-docusaurus',
    private: true,
    scripts: {
      start: 'docusaurus start',
      build: 'docusaurus build',
    },
    dependencies: {
      '@docusaurus/core': '^3.10.0',
      '@docusaurus/preset-classic': '^3.10.0',
      '@docusaurus/faster': '^3.10.0',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
    },
  }
  fs.writeFileSync(
    path.join(DOCUSAURUS_DIR, 'package.json'),
    JSON.stringify(docusaurusPkg, null, 2),
  )

  // Docusaurus config (with Docusaurus Faster enabled)
  const docusaurusConfig = `module.exports = {
  title: 'Docusaurus Benchmark',
  tagline: 'Benchmark site',
  url: 'https://benchmark.example.com',
  baseUrl: '/',
  onBrokenLinks: 'ignore',
  onBrokenMarkdownLinks: 'ignore',
  future: {
    v4: true,
    faster: true,
  },
  presets: [
    [
      '@docusaurus/preset-classic',
      {
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      },
    ],
  ],
};`
  fs.writeFileSync(
    path.join(DOCUSAURUS_DIR, 'docusaurus.config.js'),
    docusaurusConfig,
  )

  // sidebars.js
  const docusaurusSidebars = `module.exports = {
  mySidebar: [{ type: 'autogenerated', dirName: '.' }],
};`
  fs.writeFileSync(path.join(DOCUSAURUS_DIR, 'sidebars.js'), docusaurusSidebars)

  // custom.css
  fs.mkdirSync(path.join(DOCUSAURUS_DIR, 'src/css'), { recursive: true })
  fs.writeFileSync(path.join(DOCUSAURUS_DIR, 'src/css/custom.css'), '')
}

// Runs package installations
function runInstallation() {
  // P2-00: --quick mode skips install if node_modules already exist
  if (IS_QUICK) {
    const boltdocsModules = path.join(BOLTDOCS_DIR, 'node_modules')
    const docusaurusModules = path.join(DOCUSAURUS_DIR, 'node_modules')
    if (fs.existsSync(boltdocsModules) && fs.existsSync(docusaurusModules)) {
      console.log('  --quick: node_modules exist, skipping installation')
      return
    }
  }

  console.log('Installing dependencies for Docusaurus benchmark...')
  try {
    child_process.execSync(
      'pnpm install --ignore-workspace --no-frozen-lockfile',
      {
        cwd: DOCUSAURUS_DIR,
        stdio: 'inherit',
      },
    )
    console.log('✅ Docusaurus dependencies installed.')
  } catch (err) {
    console.error('Failed to install Docusaurus dependencies with pnpm:', err)
    throw err
  }

  console.log('Installing dependencies for Boltdocs benchmark...')
  try {
    child_process.execSync(
      'pnpm install --ignore-workspace --no-frozen-lockfile',
      {
        cwd: BOLTDOCS_DIR,
        stdio: 'inherit',
      },
    )
    console.log('✅ Boltdocs dependencies installed.')
  } catch (err) {
    console.error('Failed to install Boltdocs dependencies with pnpm:', err)
    throw err
  }

  // P2-00: After install, verify boltdocs binary exists
  const boltdocsCLI = path.resolve(BOLTDOCS_DIR, 'node_modules/.bin/boltdocs')
  if (fs.existsSync(boltdocsCLI)) {
    console.log(`  ✅ boltdocs CLI found at ${boltdocsCLI}`)
  } else {
    console.warn(`  ⚠️  boltdocs CLI not found at ${boltdocsCLI}`)
    // Fallback: look for it elsewhere
    const altPaths = [
      path.resolve(BOLTDOCS_DIR, 'node_modules/boltdocs/bin/boltdocs.js'),
      path.resolve(BOLTDOCS_DIR, 'node_modules/boltdocs/bin/boltdocs.mjs'),
    ]
    for (const altPath of altPaths) {
      if (fs.existsSync(altPath)) {
        console.log(`  ✅ Found at ${altPath}`)
        break
      }
    }
  }
}

// Measure build speed (returns seconds)
function measureBuild(command: string, args: string[], cwd: string): number {
  const start = process.hrtime.bigint()
  const result = child_process.spawnSync(command, args, {
    cwd,
    env: {
      ...process.env,
      CI: 'true',
      NODE_ENV: 'production',
      BOLTDOCS_BENCHMARK_PHASES: 'true',
    },
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    throw new Error(`Build failed with exit code ${result.status}`)
  }
  const end = process.hrtime.bigint()
  return Number(end - start) / 1e9
}

// Measure Dev server startup time (returns ms)
function measureDevServer(
  command: string,
  args: string[],
  cwd: string,
  readyRegex: RegExp,
): Promise<number> {
  return new Promise((resolve, reject) => {
    const start = process.hrtime.bigint()
    const child = child_process.spawn(command, args, { cwd, detached: true })
    let resolved = false
    let stderrOutput = ''
    let stdoutOutput = ''

    const cleanup = () => {
      if (child.pid) {
        try {
          process.kill(-child.pid)
        } catch {
          child.kill('SIGTERM')
        }
      }
    }

    const onData = (data: Buffer) => {
      const output = data.toString()
      stdoutOutput += output
      if (readyRegex.test(output)) {
        if (!resolved) {
          resolved = true
          const end = process.hrtime.bigint()
          const ms = Number(end - start) / 1e6
          cleanup()
          resolve(ms)
        }
      }
    }

    const onErrData = (data: Buffer) => {
      const output = data.toString()
      stderrOutput += output
      onData(data)
    }

    child.stdout.on('data', onData)
    child.stderr.on('data', onErrData)

    child.on('error', (err) => {
      if (!resolved) {
        resolved = true
        reject(err)
      }
    })

    child.on('exit', (code) => {
      if (!resolved) {
        resolved = true
        reject(
          new Error(
            `Dev server exited early with code ${code}.\nStdout: ${stdoutOutput}\nStderr: ${stderrOutput}`,
          ),
        )
      }
    })

    setTimeout(() => {
      if (!resolved) {
        resolved = true
        cleanup()
        reject(
          new Error(
            `Dev server startup timed out after 30 seconds.\nStdout: ${stdoutOutput}\nStderr: ${stderrOutput}`,
          ),
        )
      }
    }, 30000)
  })
}

async function runOnce() {
  console.log('\n--- Benchmarking Boltdocs ---')
  const boltdocsCLI = path.resolve(
    BOLTDOCS_DIR,
    'node_modules/boltdocs/bin/boltdocs.js',
  )

  // 1. Dev Startup (Boltdocs)
  console.log('Measuring Boltdocs Dev Server startup...')
  const devServerStartBoltdocs = await measureDevServer(
    'node',
    [boltdocsCLI, 'dev'],
    BOLTDOCS_DIR,
    /http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0):\d+/i,
  )
  console.log(`Boltdocs Dev Startup: ${devServerStartBoltdocs.toFixed(1)}ms`)

  // 2. Cold Build (Boltdocs)
  console.log('Measuring Boltdocs Cold Build...')
  const cacheDir = path.join(BOLTDOCS_DIR, '.boltdocs')
  const distDir = path.join(BOLTDOCS_DIR, 'dist')
  if (fs.existsSync(cacheDir))
    fs.rmSync(cacheDir, { recursive: true, force: true })
  if (fs.existsSync(distDir))
    fs.rmSync(distDir, { recursive: true, force: true })

  const buildTimeColdBoltdocs = measureBuild(
    'node',
    [boltdocsCLI, 'build'],
    BOLTDOCS_DIR,
  )
  console.log(`Boltdocs Cold Build: ${buildTimeColdBoltdocs.toFixed(2)}s`)

  // 3. Warm Build (Boltdocs): repeat with identical inputs.
  console.log('Measuring Boltdocs Warm Build...')
  const buildTimeWarmBoltdocs = measureBuild(
    'node',
    [boltdocsCLI, 'build'],
    BOLTDOCS_DIR,
  )
  console.log(`Boltdocs Warm Build: ${buildTimeWarmBoltdocs.toFixed(2)}s`)

  // 4. Edited-input rebuild (Boltdocs): edit exactly one page, then restore it.
  // This measures the same full CLI build operation as Docusaurus; it is not HMR timing.
  console.log('Measuring Boltdocs Edited-input Rebuild...')
  const randomPage = path.join(
    BOLTDOCS_DIR,
    PAGE_COUNT > 0 ? `docs/page-${EDITED_PAGE_NUMBER}.md` : 'docs/index.md',
  )
  const originalBoltdocsPage = fs.readFileSync(randomPage, 'utf8')
  fs.appendFileSync(
    randomPage,
    '\n\n## Edited Section\nThis is an incremental change.\n',
  )
  let buildTimeEditedRebuildBoltdocs: number
  try {
    buildTimeEditedRebuildBoltdocs = measureBuild(
      'node',
      [boltdocsCLI, 'build'],
      BOLTDOCS_DIR,
    )
  } finally {
    fs.writeFileSync(randomPage, originalBoltdocsPage, 'utf8')
  }
  console.log(
    `Boltdocs Edited-input Rebuild: ${buildTimeEditedRebuildBoltdocs.toFixed(2)}s`,
  )

  // 5. Bundle Size (Boltdocs)
  const bundleSizeBoltdocs = getDirSize(distDir) / 1024 // in KB
  console.log(`Boltdocs Output size: ${bundleSizeBoltdocs.toFixed(1)} KB`)

  console.log('\n--- Benchmarking Docusaurus ---')

  // 1. Dev Startup (Docusaurus)
  console.log('Measuring Docusaurus Dev Server startup...')
  // Use port 3030 to avoid collisions
  const devServerStartDocusaurus = await measureDevServer(
    'pnpm',
    ['exec', 'docusaurus', 'start', '--port', '3030', '--no-open'],
    DOCUSAURUS_DIR,
    /http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0):\d+/i,
  )
  console.log(
    `Docusaurus Dev Startup: ${devServerStartDocusaurus.toFixed(1)}ms`,
  )

  // 2. Cold Build (Docusaurus)
  console.log('Measuring Docusaurus Cold Build...')
  const docCacheDir = path.join(DOCUSAURUS_DIR, '.docusaurus')
  const docBuildDir = path.join(DOCUSAURUS_DIR, 'build')
  if (fs.existsSync(docCacheDir))
    fs.rmSync(docCacheDir, { recursive: true, force: true })
  if (fs.existsSync(docBuildDir))
    fs.rmSync(docBuildDir, { recursive: true, force: true })

  const buildTimeColdDocusaurus = measureBuild(
    'pnpm',
    ['exec', 'docusaurus', 'build'],
    DOCUSAURUS_DIR,
  )
  console.log(`Docusaurus Cold Build: ${buildTimeColdDocusaurus.toFixed(2)}s`)

  // 3. Warm Build (Docusaurus): repeat with identical inputs.
  console.log('Measuring Docusaurus Warm Build...')
  const buildTimeWarmDocusaurus = measureBuild(
    'pnpm',
    ['exec', 'docusaurus', 'build'],
    DOCUSAURUS_DIR,
  )
  console.log(`Docusaurus Warm Build: ${buildTimeWarmDocusaurus.toFixed(2)}s`)

  // 4. Edited-input rebuild (Docusaurus): Docusaurus production builds are
  // full rebuilds, so this is not an HMR/incremental-build comparison.
  console.log('Measuring Docusaurus Edited-input Rebuild...')
  const docRandomPage = path.join(
    DOCUSAURUS_DIR,
    PAGE_COUNT > 0 ? `docs/page-${EDITED_PAGE_NUMBER}.md` : 'docs/index.md',
  )
  const originalDocusaurusPage = fs.readFileSync(docRandomPage, 'utf8')
  fs.appendFileSync(
    docRandomPage,
    '\n\n## Edited Section\nThis is an incremental change.\n',
  )
  let buildTimeEditedRebuildDocusaurus: number
  try {
    buildTimeEditedRebuildDocusaurus = measureBuild(
      'pnpm',
      ['exec', 'docusaurus', 'build'],
      DOCUSAURUS_DIR,
    )
  } finally {
    fs.writeFileSync(docRandomPage, originalDocusaurusPage, 'utf8')
  }
  console.log(
    `Docusaurus Edited-input Rebuild: ${buildTimeEditedRebuildDocusaurus.toFixed(2)}s`,
  )

  // 5. Bundle Size (Docusaurus)
  const bundleSizeDocusaurus = getDirSize(docBuildDir) / 1024 // in KB
  console.log(`Docusaurus Output size: ${bundleSizeDocusaurus.toFixed(1)} KB`)

  const boltdocsInventory = getOutputInventory(distDir)
  const docusaurusInventory = getOutputInventory(docBuildDir)
  const expectedDocumentRoutes = [
    '/',
    ...Array.from({ length: PAGE_COUNT }, (_, index) => `/page-${index + 1}`),
  ]
  // Both generators may choose different valid route ordering (for example,
  // lexicographic `page-10` before `page-2` versus numeric ordering). Compare
  // the normalized route set rather than an incidental traversal order.
  const expectedRouteSignature = JSON.stringify(
    [...expectedDocumentRoutes].sort(),
  )
  boltdocsInventory.documentRoutes.sort()
  docusaurusInventory.documentRoutes.sort()
  if (
    JSON.stringify(boltdocsInventory.documentRoutes) !==
      expectedRouteSignature ||
    JSON.stringify(docusaurusInventory.documentRoutes) !==
      expectedRouteSignature
  ) {
    throw new Error(
      `Output route parity failed: expected ${expectedRouteSignature}, ` +
        `Boltdocs=${JSON.stringify(boltdocsInventory.documentRoutes)}, ` +
        `Docusaurus=${JSON.stringify(docusaurusInventory.documentRoutes)}`,
    )
  }

  // Write Results
  const results = {
    pageCount: PAGE_COUNT,
    timestamp: new Date().toISOString(),
    buildTimeCold: {
      boltdocs: Number(buildTimeColdBoltdocs.toFixed(2)),
      docusaurus: Number(buildTimeColdDocusaurus.toFixed(2)),
      ratio: Number(
        (buildTimeColdDocusaurus / buildTimeColdBoltdocs).toFixed(1),
      ),
    },
    buildTimeWarm: {
      boltdocs: Number(buildTimeWarmBoltdocs.toFixed(2)),
      docusaurus: Number(buildTimeWarmDocusaurus.toFixed(2)),
      ratio: Number(
        (buildTimeWarmDocusaurus / buildTimeWarmBoltdocs).toFixed(1),
      ),
    },
    buildTimeEditedRebuild: {
      boltdocs: Number(buildTimeEditedRebuildBoltdocs.toFixed(2)),
      docusaurus: Number(buildTimeEditedRebuildDocusaurus.toFixed(2)),
      ratio: Number(
        (
          buildTimeEditedRebuildDocusaurus / buildTimeEditedRebuildBoltdocs
        ).toFixed(1),
      ),
    },
    devServerStart: {
      boltdocs: Number(devServerStartBoltdocs.toFixed(0)),
      docusaurus: Number(devServerStartDocusaurus.toFixed(0)),
      ratio: Number(
        (devServerStartDocusaurus / devServerStartBoltdocs).toFixed(1),
      ),
    },
    bundleSize: {
      boltdocs: Number(bundleSizeBoltdocs.toFixed(0)),
      docusaurus: Number(bundleSizeDocusaurus.toFixed(0)),
      ratio: Number((bundleSizeDocusaurus / bundleSizeBoltdocs).toFixed(1)),
    },
    outputInventory: {
      boltdocs: boltdocsInventory,
      docusaurus: docusaurusInventory,
    },
  }

  const outputDir = path.resolve(WORKSPACE_ROOT, 'docs/src/data')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  const outputPath = path.join(outputDir, 'benchmark-results.json')
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2))
  console.log(`\n🎉 Benchmarking complete! Results saved to ${outputPath}`)

  return results
}

async function run() {
  setupSandbox()
  generateMarkdownPages()
  writeConfigs()
  runInstallation()

  const results: Array<Awaited<ReturnType<typeof runOnce>>> = []
  for (let runIndex = 0; runIndex < RUNS; runIndex++) {
    console.log(`\\n=== Comparison run ${runIndex + 1}/${RUNS} ===`)
    results.push(await runOnce())
  }

  const aggregate = {
    pageCount: PAGE_COUNT,
    runs: RUNS,
    complex: IS_COMPLEX,
    timestamp: new Date().toISOString(),
    metrics: {
      buildTimeCold: {
        boltdocs: summarizeSamples(
          results.map((r) => r.buildTimeCold.boltdocs),
        ),
        docusaurus: summarizeSamples(
          results.map((r) => r.buildTimeCold.docusaurus),
        ),
      },
      buildTimeWarm: {
        boltdocs: summarizeSamples(
          results.map((r) => r.buildTimeWarm.boltdocs),
        ),
        docusaurus: summarizeSamples(
          results.map((r) => r.buildTimeWarm.docusaurus),
        ),
      },
      buildTimeEditedRebuild: {
        boltdocs: summarizeSamples(
          results.map((r) => r.buildTimeEditedRebuild.boltdocs),
        ),
        docusaurus: summarizeSamples(
          results.map((r) => r.buildTimeEditedRebuild.docusaurus),
        ),
      },
      devServerStart: {
        boltdocs: summarizeSamples(
          results.map((r) => r.devServerStart.boltdocs),
        ),
        docusaurus: summarizeSamples(
          results.map((r) => r.devServerStart.docusaurus),
        ),
      },
      bundleSize: {
        boltdocs: summarizeSamples(results.map((r) => r.bundleSize.boltdocs)),
        docusaurus: summarizeSamples(
          results.map((r) => r.bundleSize.docusaurus),
        ),
      },
    },
    samples: results,
  }

  const outputDir = path.resolve(WORKSPACE_ROOT, 'docs/src/data')
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = path.join(outputDir, 'benchmark-results.json')
  fs.writeFileSync(outputPath, JSON.stringify(aggregate, null, 2))
  console.log(
    `\\n🎉 Comparison complete across ${RUNS} run(s). Results saved to ${outputPath}`,
  )
  console.log(
    `Cold median: Boltdocs ${aggregate.metrics.buildTimeCold.boltdocs.median.toFixed(2)}s / ` +
      `Docusaurus ${aggregate.metrics.buildTimeCold.docusaurus.median.toFixed(2)}s`,
  )
  console.log(
    `Warm median: Boltdocs ${aggregate.metrics.buildTimeWarm.boltdocs.median.toFixed(2)}s / ` +
      `Docusaurus ${aggregate.metrics.buildTimeWarm.docusaurus.median.toFixed(2)}s`,
  )
  console.log('Cleaning sandbox...')
  fs.rmSync(TEMP_ROOT, { recursive: true, force: true })
}

run().catch((err) => {
  try {
    fs.rmSync(TEMP_ROOT, { recursive: true, force: true })
  } catch {
    // Preserve the original benchmark error if cleanup also fails.
  }
  console.error('Benchmark execution failed:', err)
  process.exit(1)
})
