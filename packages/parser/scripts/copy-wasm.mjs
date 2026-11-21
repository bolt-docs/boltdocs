#!/usr/bin/env node

// Copies the compiled WASM module into dist/ so it ships in the npm tarball.
// Local builds stay tolerant (Zig is optional for contributors); CI and
// `prepack` are strict because a published parser without the WASM fallback
// leaves Windows and unsupported platforms with no parser at all.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageDir = path.resolve(__dirname, '..')
const source = path.join(packageDir, 'zig-out', 'bin', 'bdocs-parser.wasm')
const destination = path.join(packageDir, 'dist', 'bdocs-parser.wasm')

const required = process.argv.includes('--require') || process.env.CI === 'true'
const missing = () =>
  `[bdocs-parser] WASM not found at ${source}. Run \`pnpm build:wasm\` with Zig 0.16.0.`

if (!fs.existsSync(source)) {
  if (required) {
    console.error(missing())
    process.exit(1)
  }
  console.warn(`${missing()} Skipping (local build without Zig).`)
  process.exit(0)
}

const bytes = fs.readFileSync(source)
if (bytes.subarray(0, 4).toString('hex') !== '0061736d') {
  console.error(`[bdocs-parser] ${source} is not a valid WebAssembly module.`)
  process.exit(1)
}

fs.mkdirSync(path.dirname(destination), { recursive: true })
fs.copyFileSync(source, destination)
console.log(
  `[bdocs-parser] WASM ready: dist/bdocs-parser.wasm (${bytes.length} bytes)`,
)
