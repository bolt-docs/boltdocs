import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const TARGETS = [
  {
    triple: 'x86_64-linux-gnu',
    binary: 'parser-linux-x64',
  },
  {
    triple: 'aarch64-linux-gnu',
    binary: 'parser-linux-arm64',
  },
  {
    triple: 'x86_64-macos-none',
    binary: 'parser-darwin-x64',
  },
  {
    triple: 'aarch64-macos-none',
    binary: 'parser-darwin-arm64',
  },
  {
    triple: 'x86_64-windows-gnu',
    binary: 'parser-win-x64.exe',
  },
]

const parserDir = path.resolve(__dirname, '..')
const releasesDir = path.join(parserDir, 'releases')
const distDir = path.join(parserDir, 'dist')

console.log('Building parser for all platforms...\n')

// Create releases directory
if (!fs.existsSync(releasesDir)) {
  fs.mkdirSync(releasesDir, { recursive: true })
}

// Create dist directory for WASM
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true })
}

// Build WASM first
console.log('Building WASM...')
try {
  execSync('zig build -Dtarget=wasm32-wasi -Doptimize=ReleaseFast', {
    cwd: parserDir,
    stdio: 'inherit',
  })

  // Copy WASM to dist/
  const wasmSrc = path.join(parserDir, 'zig-out', 'bin', 'bdocs-parser.wasm')
  const wasmDest = path.join(distDir, 'bdocs-parser.wasm')
  if (fs.existsSync(wasmSrc)) {
    fs.copyFileSync(wasmSrc, wasmDest)
    console.log(`  ✓ Copied WASM to dist/bdocs-parser.wasm`)
  } else {
    console.log(`  ⚠ WASM not found: ${wasmSrc}`)
  }
} catch (error) {
  console.error(`  ✗ Failed to build WASM:`, error.message)
}
console.log()

for (const target of TARGETS) {
  console.log(`Building for ${target.triple}...`)

  try {
    execSync(`zig build -Dtarget=${target.triple} -Doptimize=ReleaseFast`, {
      cwd: parserDir,
      stdio: 'inherit',
    })

    // Copy to releases directory
    const src = path.join(parserDir, 'zig-out/bin/bdocs-parser')
    const dest = path.join(releasesDir, target.binary)

    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
      fs.chmodSync(dest, 0o755) // Set read, write, and execute permissions for the owner, and read/execute for others
      console.log(`  ✓ Copied to releases/${target.binary}`)
    } else {
      console.log(`  ⚠ Source not found: ${src}`)
    }
  } catch (error) {
    console.error(`  ✗ Failed to build for ${target.triple}:`, error.message)
  }

  console.log()
}

console.log('Build complete!')
console.log(`\nBinaries available in: ${releasesDir}`)
