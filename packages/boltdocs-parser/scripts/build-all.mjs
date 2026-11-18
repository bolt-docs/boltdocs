import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const TARGETS = [
  {
    triple: 'x86_64-linux-gnu',
    binary: 'parser-linux-x64',
    napi: 'libbdocs_parser_napi.so',
  },
  {
    triple: 'aarch64-linux-gnu',
    binary: 'parser-linux-arm64',
    napi: 'libbdocs_parser_napi.so',
  },
  {
    triple: 'x86_64-macos-none',
    binary: 'parser-darwin-x64',
    napi: 'libbdocs_parser_napi.dylib',
  },
  {
    triple: 'aarch64-macos-none',
    binary: 'parser-darwin-arm64',
    napi: 'libbdocs_parser_napi.dylib',
  },
  {
    triple: 'x86_64-windows-gnu',
    binary: 'parser-win-x64.exe',
    napi: 'bdocs_parser_napi.dll',
  },
]

const parserDir = path.resolve(__dirname, '..')
const releasesDir = path.join(parserDir, 'releases')
const distDir = path.join(parserDir, 'dist')

const Optimize = 'ReleaseSmall'

console.log('Building parser for all platforms...\n')

fs.mkdirSync(releasesDir, { recursive: true })
fs.mkdirSync(distDir, { recursive: true })

// Build WASM first (embedded in the npm package).
console.log('Building WASM...')
try {
  execSync(`zig build -Dtarget=wasm32-wasi -Doptimize=${Optimize}`, {
    cwd: parserDir,
    stdio: 'inherit',
  })
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
  const isWindows = target.triple.includes('windows')

  try {
    execSync(`zig build -Dtarget=${target.triple} -Doptimize=${Optimize}`, {
      cwd: parserDir,
      stdio: 'inherit',
    })

    const src = path.join(
      parserDir,
      'zig-out/bin',
      `bdocs-parser${isWindows ? '.exe' : ''}`,
    )
    const dest = path.join(releasesDir, target.binary)

    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
      fs.chmodSync(dest, 0o755)
      console.log(`  ✓ Copied to releases/${target.binary}`)
    } else {
      console.log(`  ⚠ Source not found: ${src}`)
    }
  } catch (error) {
    console.error(
      `  ✗ Failed to build CLI for ${target.triple}:`,
      error.message,
    )
  }

  try {
    const pic = isWindows ? '' : '-fPIC'
    execSync(
      `zig build-lib src/napi.zig -dynamic ${pic} --name bdocs_parser_napi -fstrip -O${Optimize} -lc -target ${target.triple}`,
      { cwd: parserDir, stdio: 'inherit' },
    )

    const src = path.join(parserDir, target.napi)
    const dest = path.join(releasesDir, target.napi)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest)
      fs.chmodSync(dest, 0o755)
      console.log(`  ✓ Copied to releases/${target.napi}`)
    } else {
      console.log(`  ⚠ N-API library not found: ${src}`)
    }
  } catch (error) {
    console.error(
      `  ✗ Failed to build N-API for ${target.triple}:`,
      error.message,
    )
  }

  console.log()
}

console.log('Build complete!')
console.log(`\nBinaries available in: ${releasesDir}`)
