import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { tryLoadNapi, parseWithNapi } from './src/napi-binding'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const execFilePromise = promisify(execFile)

export interface Heading {
  level: number
  text: string
  id: string
}

export interface ParsedDoc {
  rawMatter: string
  headings: Heading[]
  plainText: string
  description: string
}

// WASM binary path (shipped in dist/bdocs-parser.wasm)
const WASM_PATH = path.join(__dirname, 'bdocs-parser.wasm')

function getNativeBinaryPath(): string | null {
  const platform = process.platform
  const arch = process.arch

  const binaryMap: Record<string, string> = {
    'linux-x64': 'parser-linux-x64',
    'linux-arm64': 'parser-linux-arm64',
    'darwin-x64': 'parser-darwin-x64',
    'darwin-arm64': 'parser-darwin-arm64',
    'win32-x64': 'parser-win-x64.exe',
  }

  const key = `${platform}-${arch}`
  const binaryName = binaryMap[key]
  if (!binaryName) return null

  // 1. Cache from postinstall (node_modules/.cache/@bdocs/parser/)
  const cachePaths = [
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '.cache',
      '@bdocs',
      'parser',
      binaryName,
    ),
    path.resolve(
      __dirname,
      '..',
      '..',
      '.cache',
      '@bdocs',
      'parser',
      binaryName,
    ),
  ]

  for (const p of cachePaths) {
    if (fs.existsSync(p)) return p
  }

  // 2. Local development paths
  const localPaths = [
    path.resolve(__dirname, 'zig-out', 'bin', binaryName),
    path.resolve(__dirname, 'zig-out', 'bin', 'bdocs-parser'),
    path.resolve(__dirname, '..', 'zig-out', 'bin', binaryName),
    path.resolve(__dirname, '..', 'zig-out', 'bin', 'bdocs-parser'),
    path.resolve(__dirname, '..', '..', 'zig-out', 'bin', binaryName),
    path.resolve(__dirname, '..', '..', 'zig-out', 'bin', 'bdocs-parser'),
  ]

  for (const p of localPaths) {
    if (fs.existsSync(p)) return p
  }

  return null
}

async function runNativeParser(
  docsDir: string,
  binaryPath: string,
  turbo: boolean = false,
): Promise<Record<string, ParsedDoc>> {
  const args = ['--dir', docsDir]
  if (turbo) args.push('--turbo')
  const { stdout } = await execFilePromise(binaryPath, args, {
    maxBuffer: 50 * 1024 * 1024,
  })
  const parsed = JSON.parse(stdout)
  const normalized: Record<string, ParsedDoc> = {}
  for (const [key, value] of Object.entries(parsed)) {
    const absoluteKey = path.resolve(docsDir, key).replace(/\\/g, '/')
    normalized[absoluteKey] = value as ParsedDoc
  }
  return normalized
}

async function runWasmParser(
  docsDir: string,
  turbo: boolean = false,
): Promise<Record<string, ParsedDoc>> {
  const { WASI } = await import('node:wasi')

  // Place the WASM stdout temp file at the project root (process.cwd()),
  // NOT inside `docsDir` — a previous version resolved against `docsDir`
  // and created a stray `<docsDir>/.boltdocs/cache/` directory that
  // polluted the documentation source tree and was caught by route
  // scanners. `process.cwd()` matches what `AssetCache` and
  // `routes/parser/cache.ts` already use.
  const tempDir = path.resolve(process.cwd(), '.boltdocs/cache')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  const tempFile = path.resolve(
    tempDir,
    `parser-output-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.json`,
  )
  const fd = fs.openSync(tempFile, 'w+')

  try {
    const args = ['bdocs-parser.wasm', '--dir', '.']
    if (turbo) args.push('--turbo')

    const wasi = new WASI({
      version: 'preview1',
      args,
      preopens: {
        '.': docsDir,
      },
      stdout: fd,
    })

    const wasmBuffer = fs.readFileSync(WASM_PATH)
    const { instance } = await WebAssembly.instantiate(wasmBuffer, {
      wasi_snapshot_preview1: wasi.wasiImport,
    })

    wasi.start(instance)
    fs.closeSync(fd)

    const stdout = fs.readFileSync(tempFile, 'utf8')
    const parsed = JSON.parse(stdout)
    const normalized: Record<string, ParsedDoc> = {}
    for (const [key, value] of Object.entries(parsed)) {
      const absoluteKey = path.resolve(docsDir, key).replace(/\\/g, '/')
      normalized[absoluteKey] = value as ParsedDoc
    }
    return normalized
  } finally {
    try {
      fs.closeSync(fd)
    } catch {}
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile)
      }
    } catch {}
  }
}

/**
 * Read all MD/MDX files from a directory and build a files record.
 */
function readDocsDir(docsDir: string): Record<string, string> {
  const files: Record<string, string> = {}

  function walk(dir: string) {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        // Skip hidden directories
        if (!entry.name.startsWith('_')) {
          walk(fullPath)
        }
      } else if (entry.isFile() && /\.(md|mdx)$/i.test(entry.name)) {
        try {
          const content = fs.readFileSync(fullPath, 'utf8')
          const absolutePath = fullPath.replace(/\\/g, '/')
          files[absolutePath] = content
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  walk(docsDir)
  return files
}

/**
 * Run the parser with cross-platform strategies.
 *
 * Strategy hierarchy (fastest first):
 * 1. N-API shared library (direct FFI, no fork/exec)
 * 2. Native binary (multi-threaded, 5-10x faster than WASM)
 * 3. WASM (embedded fallback)
 *
 * - N-API: built via `pnpm build:napi`, produces .so/.dylib/.dll
 * - Native binary: downloaded from GitHub Releases via postinstall
 * - WASM binary: shipped in dist/bdocs-parser.wasm
 * - Set FORCE_WASM=true or FORCE_EXEC=true to skip faster paths
 */
export async function runParser(
  docsDir: string,
  turbo: boolean = false,
): Promise<Record<string, ParsedDoc>> {
  // 1. Try N-API shared library (fastest — direct FFI, no fork/exec)
  if (process.env.FORCE_WASM !== 'true' && process.env.FORCE_EXEC !== 'true') {
    if (tryLoadNapi()) {
      try {
        const files = readDocsDir(docsDir)
        if (Object.keys(files).length === 0) {
          return {}
        }
        return parseWithNapi(files, turbo)
      } catch {
        // Fall through to native binary
      }
    }
  }

  // 2. Try native binary
  if (process.env.FORCE_WASM !== 'true') {
    const nativePath = getNativeBinaryPath()
    if (nativePath) {
      try {
        return await runNativeParser(docsDir, nativePath, turbo)
      } catch {
        // Fall through to WASM
      }
    }
  }

  // 3. Fallback to WASM
  return await runWasmParser(docsDir, turbo)
}
