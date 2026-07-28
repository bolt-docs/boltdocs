import koffi from 'koffi'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { ParsedDoc } from './index'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let napiLib: ReturnType<typeof koffi.load> | null = null
// Note: Using 'string' return type to avoid segfault with koffi.decode().
// Trade-off: koffi's 'string' return copies the C string to JS but does NOT
// free the original malloc'd memory in the .so (~1-2 KB leaked per call).
// Acceptable for a CLI build tool (~1-2 MB total per full build).
let _parse_docs_json: ((input: string) => string | null) | null = null

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
    // koffi's 'string' return type auto-converts char* to JS string
    _parse_docs_json = napiLib.func('parse_docs_json', 'string', ['string'])
    return true
  } catch {
    napiLib = null
    _parse_docs_json = null
    return false
  }
}

/**
 * Parse a batch of file contents using the N-API shared library.
 */
export function parseWithNapi(
  files: Record<string, string>,
  turbo: boolean = false,
): Record<string, ParsedDoc> {
  if (!_parse_docs_json) {
    throw new Error('N-API library not loaded. Call tryLoadNapi() first.')
  }

  // Build JSON input matching napi.zig format
  const jsonInput = JSON.stringify({ turbo, files })

  // koffi handles the char*->JS string conversion internally.
  // The C string memory is freed by koffi, so we don't call free_result.
  const resultStr = _parse_docs_json(jsonInput)
  if (!resultStr) {
    throw new Error('parse_docs_json returned null (fatal error)')
  }

  return JSON.parse(resultStr) as Record<string, ParsedDoc>
}
