import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import {
  tryLoadNapi,
  parseWithNapi,
  parseFilesWithNapi,
} from './src/napi-binding'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const execFilePromise = promisify(execFile)

export interface Heading {
  level: number
  text: string
  id: string
}

export interface ParsedDoc {
  rawMatter: string
  content: string
  headings: Heading[]
  plainText: string
  description: string
  frontmatter?: Record<string, unknown>
}

// WASM binary path (shipped in dist/bdocs-parser.wasm)
const WASM_PATH =
  [
    path.join(__dirname, 'bdocs-parser.wasm'),
    path.join(__dirname, 'dist', 'bdocs-parser.wasm'),
    path.join(__dirname, 'zig-out', 'bin', 'bdocs-parser.wasm'),
  ].find((candidate) => fs.existsSync(candidate)) ??
  path.join(__dirname, 'bdocs-parser.wasm')

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

async function runParserWithFiles(
  docsDir: string,
  filePaths: readonly string[],
  turbo: boolean,
): Promise<Record<string, ParsedDoc>> {
  if (process.env.FORCE_WASM === 'true' || process.env.FORCE_EXEC === 'true') {
    throw new Error('Selected-file parsing requires the N-API parser')
  }
  if (!tryLoadNapi()) {
    throw new Error('Selected-file parsing requires the N-API parser')
  }
  return parseFilesWithNapi(docsDir, filePaths, turbo)
}

async function runWasmParserFiles(
  docsDir: string,
  filePaths: readonly string[],
  turbo: boolean,
): Promise<Record<string, ParsedDoc>> {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bdocs-parser-files-'))
  const absoluteDocsDir = path.resolve(docsDir)
  const realDocsDir = fs.realpathSync(absoluteDocsDir)

  try {
    for (const filePath of filePaths) {
      const absolutePath = path.resolve(filePath)
      const relativePath = path.relative(absoluteDocsDir, absolutePath)

      try {
        // Check every path component before opening. This rejects symlinked
        // intermediate directories as well as symlinked files on platforms
        // where O_NOFOLLOW is unavailable.
        let currentPath = absoluteDocsDir
        for (const segment of relativePath.split(path.sep)) {
          currentPath = path.join(currentPath, segment)
          if (fs.lstatSync(currentPath).isSymbolicLink()) {
            throw new Error(`Selected file escapes docs directory: ${filePath}`)
          }
        }

        const realFilePath = fs.realpathSync(absolutePath)
        const realRelativePath = path.relative(realDocsDir, realFilePath)
        if (
          realRelativePath === '' ||
          realRelativePath.startsWith(`..${path.sep}`) ||
          path.isAbsolute(realRelativePath)
        ) {
          throw new Error(`Selected file escapes docs directory: ${filePath}`)
        }

        const temporaryPath = path.join(tempDir, relativePath)
        fs.mkdirSync(path.dirname(temporaryPath), { recursive: true })

        // Read through a descriptor instead of copyFileSync so the final
        // component cannot be swapped to a symlink between validation and read.
        // O_NOFOLLOW is unavailable on some platforms, so use it only when the
        // host exposes it and retain the component checks above everywhere.
        const noFollow = fs.constants.O_NOFOLLOW ?? 0
        let descriptor: number | undefined
        try {
          descriptor = fs.openSync(
            absolutePath,
            fs.constants.O_RDONLY | noFollow,
          )
          const content = fs.readFileSync(descriptor, 'utf8')
          fs.writeFileSync(temporaryPath, content)
        } finally {
          if (descriptor !== undefined) fs.closeSync(descriptor)
        }
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ENOENT'
        ) {
          continue
        }
        throw error
      }
    }

    const parsed = await runWasmParser(tempDir, turbo)
    const normalized: Record<string, ParsedDoc> = {}
    for (const [temporaryPath, document] of Object.entries(parsed)) {
      const relativePath = path.relative(tempDir, temporaryPath)
      const originalPath = path
        .resolve(absoluteDocsDir, relativePath)
        .replace(/\\/g, '/')
      normalized[originalPath] = document
    }
    return normalized
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
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
    const instantiated = await WebAssembly.instantiate(wasmBuffer, {
      wasi_snapshot_preview1: wasi.wasiImport,
    })
    const instance = (
      'instance' in instantiated ? instantiated.instance : instantiated
    ) as WebAssembly.Instance

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
 * Parse only the selected documentation files.
 *
 * The native backend reads only the requested files. Other backends use their
 * existing full-directory parser and apply the same filter as a compatibility
 * fallback.
 */
export async function runParserFiles(
  docsDir: string,
  filePaths: readonly string[],
  turbo: boolean = false,
): Promise<Record<string, ParsedDoc>> {
  const selected = new Set<string>()
  for (const filePath of filePaths) {
    const absolutePath = path.resolve(filePath)
    if (!absolutePath.startsWith(path.resolve(docsDir) + path.sep)) continue
    selected.add(absolutePath.replace(/\\/g, '/'))
  }

  if (selected.size === 0) return {}

  try {
    const full = await runParserWithFiles(docsDir, [...selected], turbo)
    return Object.fromEntries(
      Object.entries(full).filter(([filePath]) => selected.has(filePath)),
    )
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes('outside docs directory') ||
        error.message.includes('escapes docs directory'))
    ) {
      throw error
    }

    // A native read can race with an unlink during HMR. Keep the selected
    // file API resilient by falling back to the portable parser for only the
    // requested files; path-validation failures remain fatal above.
    return runWasmParserFiles(docsDir, [...selected], turbo)
  }
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
        if (!fs.existsSync(docsDir)) {
          return {}
        }
        return parseWithNapi(docsDir, turbo)
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
