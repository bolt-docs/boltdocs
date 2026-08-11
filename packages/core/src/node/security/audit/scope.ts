import fs from 'node:fs'
import path from 'node:path'
import picomatch from 'picomatch'
import { DEFAULT_MAX_FILES } from './types'

const CODE_EXT_RE = /\.(?:js|mjs|cjs|ts|tsx|jsx)$/
const SKIP_FILE_RE = /\.(?:d\.ts|map)$/
const SKIP_TEST_FILE_RE = /\.(?:test|spec)\.(?:js|mjs|cjs|ts|tsx|jsx)$/

/**
 * Directories that never ship as runtime code for the audit's purposes:
 * tests, fixtures, examples, docs and build artifacts.
 */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  'test',
  '__tests__',
  'tests',
  'spec',
  'fixture',
  'fixtures',
  'example',
  'examples',
  'benchmark',
  'benchmarks',
  '.github',
  'docs',
])

function isCodeFile(name: string): boolean {
  return (
    CODE_EXT_RE.test(name) &&
    !SKIP_FILE_RE.test(name) &&
    !SKIP_TEST_FILE_RE.test(name)
  )
}

function walk(
  dir: string,
  visit: (file: string) => void,
  skipNoiseDirs: boolean,
  visited: Set<string>,
  depth: number,
): void {
  if (depth > 16) return
  let real: string
  try {
    real = fs.realpathSync(dir)
  } catch {
    return
  }
  if (visited.has(real)) return
  visited.add(real)

  let list: string[]
  try {
    list = fs.readdirSync(dir)
  } catch {
    return
  }

  for (const name of list) {
    const full = path.join(dir, name)
    let st: fs.Stats
    try {
      st = fs.statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      if (skipNoiseDirs && SKIP_DIRS.has(name)) continue
      walk(full, visit, skipNoiseDirs, visited, depth + 1)
    } else if (isCodeFile(name)) {
      visit(full)
    }
  }
}

/** Collects every string path in a possibly-nested package.json field. */
function collectStringValues(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value)
  } else if (value && typeof value === 'object') {
    for (const v of Object.values(value)) collectStringValues(v, out)
  }
}

/**
 * Entry points declared in package.json (main/module/browser/bin/exports) —
 * the runtime surfaces that always ship. These are included even when the
 * package has a `files` field that does not mention them explicitly.
 */
function getEntryFiles(
  pluginDir: string,
  pkg: Record<string, unknown>,
): string[] {
  const raw: string[] = []
  for (const field of ['main', 'module', 'browser', 'bin', 'exports']) {
    collectStringValues(pkg[field], raw)
  }

  const out: string[] = []
  const visited = new Set<string>()
  for (const rel of raw) {
    if (!rel) continue
    const abs = path.resolve(pluginDir, rel)
    if (visited.has(abs)) continue
    visited.add(abs)
    try {
      if (
        fs.existsSync(abs) &&
        fs.statSync(abs).isFile() &&
        isCodeFile(path.basename(abs))
      ) {
        out.push(abs)
      }
    } catch {
      // ignore unresolvable entries
    }
  }
  return out
}

/**
 * Expands the package.json `files` field (npm publish whitelist) into a list
 * of absolute code files. Supports plain paths, directories and simple globs.
 */
function expandFilesField(
  pluginDir: string,
  patterns: string[],
  maxFiles: number,
): string[] {
  const out: string[] = []
  const visited = new Set<string>()

  const push = (abs: string) => {
    if (out.length >= maxFiles) return
    let real: string
    try {
      real = fs.realpathSync(abs)
    } catch {
      return
    }
    if (visited.has(real)) return
    visited.add(real)
    out.push(abs)
  }

  for (const rawPattern of patterns) {
    if (out.length >= maxFiles) break
    if (rawPattern.startsWith('!')) continue // negations not supported
    const p = rawPattern.replace(/^\.\//, '')
    if (p.includes('*')) {
      const prefix = p.slice(0, p.indexOf('*'))
      const base = path.join(pluginDir, prefix)
      if (fs.existsSync(base)) {
        const matcher = picomatch(p)
        walk(
          base,
          (f) => {
            if (matcher(path.relative(pluginDir, f))) push(f)
          },
          true,
          new Set<string>(),
          0,
        )
      }
    } else {
      const abs = path.join(pluginDir, p)
      try {
        const st = fs.statSync(abs)
        if (st.isDirectory()) {
          walk(abs, push, true, new Set<string>(), 0)
        } else if (isCodeFile(path.basename(abs))) {
          push(abs)
        }
      } catch {
        // ignore missing patterns
      }
    }
  }
  return out
}

/**
 * Deterministically selects the files of a plugin package worth auditing:
 * shipped runtime code only. Never follows into node_modules of the plugin
 * itself, never scans tests/examples/docs, and caps the total count.
 */
export function selectShippedFiles(
  pluginDir: string,
  pkg: Record<string, unknown>,
  maxFiles: number = DEFAULT_MAX_FILES,
): string[] {
  const selected: string[] = []
  const seen = new Set<string>()

  const push = (abs: string) => {
    if (selected.length >= maxFiles) return
    let real: string
    try {
      real = fs.realpathSync(abs)
    } catch {
      return
    }
    if (seen.has(real)) return
    seen.add(real)
    selected.push(abs)
  }

  // 1. Entry points always ship.
  for (const entry of getEntryFiles(pluginDir, pkg)) push(entry)

  // 2. Respect the `files` publish whitelist when present.
  if (Array.isArray(pkg.files)) {
    for (const f of expandFilesField(
      pluginDir,
      pkg.files as string[],
      maxFiles,
    )) {
      push(f)
    }
  } else {
    // 3. Otherwise scan the whole package minus obvious noise.
    walk(pluginDir, push, true, new Set<string>(), 0)
  }

  return selected.sort()
}
