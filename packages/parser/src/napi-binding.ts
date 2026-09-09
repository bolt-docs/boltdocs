import koffi from 'koffi'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ParsedDoc } from '../index'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let napiLib: ReturnType<typeof koffi.load> | null = null
// The directory API removes the large JS→Zig JSON input allocation. Koffi's
// disposable return type converts the native char* to a JS string and calls
// the exported free_result function after conversion.
type ParseDocsDirectory = (docsDir: string, turbo: number) => string | null

type ParseDocsFiles = (
  docsDir: string,
  filesJson: string,
  turbo: number,
) => string | null

let _parse_docs_directory: ParseDocsDirectory | null = null
let _parse_docs_files: ParseDocsFiles | null = null

function getLibraryPath(): string | null {
  const platform = process.platform
  const libName =
    platform === 'win32'
      ? 'bdocs_parser_napi.dll'
      : platform === 'darwin'
        ? 'libbdocs_parser_napi.dylib'
        : 'libbdocs_parser_napi.so'

  // Paths to search for the shared library
  const searchPaths = [
    // Next to bundled dist
    path.resolve(__dirname, libName),
    // Package root (development)
    path.resolve(__dirname, '..', libName),
    // zig-out/lib (build output)
    path.resolve(__dirname, '..', 'zig-out', 'lib', libName),
  ]

  for (const p of searchPaths) {
    if (fs.existsSync(p)) return p
  }

  return null
}

/**
 * Try to load the N-API shared library.
 * Returns true if the library was loaded successfully.
 */
export function tryLoadNapi(): boolean {
  if (napiLib) return true

  const libPath = getLibraryPath()
  if (!libPath) {
    return false
  }

  try {
    napiLib = koffi.load(libPath)
    const disposableString = koffi.disposable(
      'BoltdocsNativeResult',
      'str',
      napiLib.func('free_result', 'void', ['str']),
    )
    _parse_docs_directory = napiLib.func(
      'parse_docs_directory',
      disposableString,
      ['string', 'int'],
    ) as unknown as ParseDocsDirectory
    _parse_docs_files = napiLib.func('parse_docs_files', disposableString, [
      'string',
      'string',
      'int',
    ]) as unknown as ParseDocsFiles
    return true
  } catch {
    napiLib = null
    _parse_docs_directory = null
    _parse_docs_files = null
    return false
  }
}

/**
 * Parse every Markdown document below `docsDir` in the native backend.
 *
 * Directory discovery, file reads, and parallel parsing all happen in Zig.
 * This intentionally replaces the old Record<string, string> contract so a
 * full build no longer serializes the entire source tree into an FFI payload.
 */
function parseNativeResult(result: string | null): Record<string, ParsedDoc> {
  if (result === null) {
    throw new Error('Native parser returned null (fatal error)')
  }
  return JSON.parse(result) as Record<string, ParsedDoc>
}

export function parseWithNapi(
  docsDir: string,
  turbo: boolean = false,
): Record<string, ParsedDoc> {
  if (!_parse_docs_directory) {
    throw new Error('N-API library not loaded. Call tryLoadNapi() first.')
  }

  const result = _parse_docs_directory(path.resolve(docsDir), turbo ? 1 : 0)
  return parseNativeResult(result)
}

/**
 * Parse only the requested files below `docsDir`.
 * Paths are validated and resolved in Zig; no directory discovery occurs.
 */
export function parseFilesWithNapi(
  docsDir: string,
  filePaths: readonly string[],
  turbo: boolean = false,
): Record<string, ParsedDoc> {
  if (!_parse_docs_files) {
    throw new Error('N-API library not loaded. Call tryLoadNapi() first.')
  }

  const absoluteDocsDir = path.resolve(docsDir)
  const realDocsDir = fs.realpathSync(absoluteDocsDir)
  const relativePaths = filePaths.map((filePath) => {
    const absolutePath = path.resolve(filePath)
    const relativePath = path.relative(absoluteDocsDir, absolutePath)
    if (
      relativePath === '' ||
      relativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativePath)
    ) {
      throw new Error(`File is outside docs directory: ${filePath}`)
    }

    // Validate symlink targets before crossing the FFI boundary. This keeps
    // selected-file parsing inside the real docs tree, including when a file
    // or an intermediate directory is a symlink.
    let realFilePath: string
    try {
      realFilePath = fs.realpathSync(absolutePath)
    } catch {
      throw new Error(`Selected file is unavailable: ${filePath}`)
    }
    const realRelativePath = path.relative(realDocsDir, realFilePath)
    if (
      realRelativePath === '' ||
      realRelativePath.startsWith(`..${path.sep}`) ||
      path.isAbsolute(realRelativePath)
    ) {
      throw new Error(`Selected file escapes docs directory: ${filePath}`)
    }

    return relativePath.replace(/\\/g, '/')
  })

  const result = _parse_docs_files(
    absoluteDocsDir,
    JSON.stringify(relativePaths),
    turbo ? 1 : 0,
  )
  return parseNativeResult(result)
}
