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
const PAGE_COUNT = Number(process.env.PAGE_COUNT) || 10000

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

// Generate identical markdown files for both
function generateMarkdownPages() {
  console.log(`Generating ${PAGE_COUNT} Markdown pages...`)
  const boltdocsDocs = path.join(BOLTDOCS_DIR, 'docs')
  const docusaurusDocs = path.join(DOCUSAURUS_DIR, 'docs')

  fs.mkdirSync(boltdocsDocs, { recursive: true })
  fs.mkdirSync(docusaurusDocs, { recursive: true })

  // Write index.md
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
    const content = `---
title: Benchmarking Page ${i}
sidebar_label: Page ${i}
tags:
  - benchmark
  - performance
  - docs
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
    fs.writeFileSync(path.join(boltdocsDocs, `page-${i}.md`), content)
    fs.writeFileSync(path.join(docusaurusDocs, `page-${i}.md`), content)
  }
  console.log('✅ Pages generated successfully.')
}

// Set up minimal configuration files
function writeConfigs() {
  console.log('Writing configuration files...')

  // Boltdocs Config
  // Using a plain object export to bypass node_modules resolution issues in sandbox
  const boltdocsConfig = `export default {
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

  // Boltdocs package.json to set type: module and avoid ESM reparsing warning/overhead
  const boltdocsPkg = {
    name: 'benchmark-boltdocs',
    private: true,
    type: 'module',
    dependencies: {
      boltdocs: '3.1.0',
      '@bdocs/zig-critters':
        'file:/tmp/boltdocs-pack/bdocs-zig-critters-0.2.0.tgz',
      react: '^19.0.0',
      'react-dom': '^19.0.0',
    },
    pnpm: {
      overrides: {
        '@bdocs/zig-critters':
          'file:/tmp/boltdocs-pack/bdocs-zig-critters-0.2.0.tgz',
      },
    },
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
    console.error(
      'Failed to install Docusaurus dependencies with pnpm, trying npm...',
      err,
    )
    try {
      child_process.execSync('npm install --no-audit --no-fund', {
        cwd: DOCUSAURUS_DIR,
        stdio: 'inherit',
      })
      console.log('✅ Docusaurus dependencies installed with npm.')
    } catch (npmErr) {
      console.error('Failed both pnpm and npm installs:', npmErr)
      throw npmErr
    }
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
    console.error(
      'Failed to install Boltdocs dependencies with pnpm, trying npm...',
      err,
    )
    try {
      child_process.execSync('npm install --no-audit --no-fund', {
        cwd: BOLTDOCS_DIR,
        stdio: 'inherit',
      })
      console.log('✅ Boltdocs dependencies installed with npm.')
    } catch (npmErr) {
      console.error('Failed both pnpm and npm installs for Boltdocs:', npmErr)
      throw npmErr
    }
  }
}

// Measure build speed (returns seconds)
function measureBuild(command: string, args: string[], cwd: string): number {
  const start = process.hrtime.bigint()
  const result = child_process.spawnSync(command, args, {
    cwd,
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

async function run() {
  setupSandbox()
  generateMarkdownPages()
  writeConfigs()
  runInstallation()

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

  // 3. Warm Build (Boltdocs)
  console.log('Measuring Boltdocs Warm Build...')
  // Mutate one file slightly
  const randomPage = path.join(BOLTDOCS_DIR, 'docs/page-50.md')
  fs.appendFileSync(
    randomPage,
    '\n\n## Edited Section\nThis is an incremental change.\n',
  )

  const buildTimeWarmBoltdocs = measureBuild(
    'node',
    [boltdocsCLI, 'build'],
    BOLTDOCS_DIR,
  )
  console.log(`Boltdocs Warm Build: ${buildTimeWarmBoltdocs.toFixed(2)}s`)

  // 4. Bundle Size (Boltdocs)
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

  // 3. Warm Build (Docusaurus)
  console.log('Measuring Docusaurus Warm Build...')
  const docRandomPage = path.join(DOCUSAURUS_DIR, 'docs/page-50.md')
  fs.appendFileSync(
    docRandomPage,
    '\n\n## Edited Section\nThis is an incremental change.\n',
  )

  const buildTimeWarmDocusaurus = measureBuild(
    'pnpm',
    ['exec', 'docusaurus', 'build'],
    DOCUSAURUS_DIR,
  )
  console.log(`Docusaurus Warm Build: ${buildTimeWarmDocusaurus.toFixed(2)}s`)

  // 4. Bundle Size (Docusaurus)
  const bundleSizeDocusaurus = getDirSize(docBuildDir) / 1024 // in KB
  console.log(`Docusaurus Output size: ${bundleSizeDocusaurus.toFixed(1)} KB`)

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
  }

  const outputDir = path.resolve(WORKSPACE_ROOT, 'docs/src/data')
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }
  const outputPath = path.join(outputDir, 'benchmark-results.json')
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2))
  console.log(`\n🎉 Benchmarking complete! Results saved to ${outputPath}`)

  // Clean up sandbox to keep workspace clean
  console.log(`Cleaning sandbox...`)
  // fs.rmSync(TEMP_ROOT, { recursive: true, force: true })
}

run().catch((err) => {
  console.error('Benchmark execution failed:', err)
  process.exit(1)
})
