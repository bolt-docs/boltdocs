import fs from 'node:fs'
import path from 'node:path'
import type { MigrationFinding } from './types'

export function finding(
  partial: Omit<MigrationFinding, 'detail'> & { detail?: string },
): MigrationFinding {
  return {
    detail: partial.detail ?? partial.title,
    ...partial,
  }
}

export function readText(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf-8')
  } catch {
    return null
  }
}

export function writeText(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf-8')
}

/** Parse JSON from a file. Callers narrow the result with the helpers below. */
function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export function readJson(file: string): unknown {
  try {
    return parseJson(fs.readFileSync(file, 'utf-8'))
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** Runtime-narrow an unknown JSON value to a plain object (same reference). */
function asRecord(value: unknown): JsonRecord | null {
  return isRecord(value) ? value : null
}

/** Runtime-narrow an object's entry to a string map. */
function asStringRecord(value: unknown): Record<string, string> | null {
  const record = asRecord(value)
  if (!record) return null
  const out: Record<string, string> = {}
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry !== 'string') return null
    out[key] = entry
  }
  return out
}

/** Read a JSON object, rejecting arrays and primitive JSON values. */
export function readJsonRecord(file: string): JsonRecord | null {
  return asRecord(readJson(file))
}

export function exists(file: string): boolean {
  try {
    return fs.existsSync(file)
  } catch {
    return false
  }
}

export function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true })
}

function isInside(target: string, container: string): boolean {
  const t = path.resolve(target)
  const c = path.resolve(container)
  return t === c || t.startsWith(c + path.sep) || c.startsWith(t + path.sep)
}

export function copyPath(src: string, dest: string): number {
  if (!exists(src)) return 0
  const stat = fs.statSync(src)
  if (stat.isFile()) {
    ensureDir(path.dirname(dest))
    fs.copyFileSync(src, dest)
    return 1
  }
  if (!stat.isDirectory()) return 0
  ensureDir(dest)
  let count = 0
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (isInside(d, s) || isInside(s, d)) continue
    if (entry.isDirectory()) count += copyPath(s, d)
    else if (entry.isFile()) {
      ensureDir(path.dirname(d))
      fs.copyFileSync(s, d)
      count++
    }
  }
  return count
}

export function moveDirContents(src: string, dest: string): number {
  if (!exists(src)) return 0
  ensureDir(dest)
  let count = 0
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name)
    const d = path.join(dest, entry.name)
    if (isInside(d, s) || isInside(s, d)) continue
    ensureDir(path.dirname(d))
    try {
      fs.renameSync(s, d)
      count++
    } catch {
      count += copyPath(s, d)
      try {
        fs.rmSync(s, { recursive: true, force: true })
      } catch {}
    }
  }
  return count
}

export function walkFiles(
  dir: string,
  exts: Set<string>,
  out: string[] = [],
): string[] {
  if (!exists(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === '.boltdocs' ||
        entry.name === 'dist' ||
        entry.name === 'build'
      ) {
        continue
      }
      walkFiles(full, exts, out)
    } else if (entry.isFile() && exts.has(path.extname(entry.name))) {
      out.push(full)
    }
  }
  return out
}

/** Copy a content tree and run a transform over every Markdown file in the copy. */
export function copyAndTransformMarkdown(
  src: string,
  dest: string,
  transform: (file: string) => void,
): void {
  copyPath(src, dest)
  for (const file of walkFiles(dest, new Set(['.md', '.mdx']))) transform(file)
}

export function walkDirs(dir: string, out: string[] = []): string[] {
  if (!exists(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (
      entry.name === 'node_modules' ||
      entry.name === '.git' ||
      entry.name === '.boltdocs' ||
      entry.name === 'dist' ||
      entry.name === 'build'
    ) {
      continue
    }
    const full = path.join(dir, entry.name)
    out.push(full)
    walkDirs(full, out)
  }
  return out
}

export interface ParsedFrontmatter {
  raw: string
  body: string
  /** Original line ending, so a rewrite does not reformat the whole file. */
  eol: string
  /** Original UTF-8 BOM, preserved on write. */
  bom: string
}

/**
 * Parse a leading YAML frontmatter block.
 *
 * Handles CRLF, a UTF-8 BOM and a closing delimiter with trailing spaces.
 * A `---` inside a quoted value or a fenced code block is not treated as the
 * closing delimiter unless it is alone on its line.
 */
export function parseFrontmatter(source: string): ParsedFrontmatter | null {
  const bom = source.startsWith('\uFEFF') ? '\uFEFF' : ''
  const text = bom ? source.slice(1) : source
  if (!text.startsWith('---')) return null
  const eol = text.includes('\r\n') ? '\r\n' : text.includes('\n') ? '\n' : '\r'
  const lines = text.split(/\r\n|\n|\r/)

  let close = -1
  let fence: string | null = null
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    const fenceMatch = /^(\s*)(`{3,}|~{3,})/.exec(line)
    if (fence) {
      if (fenceMatch && fenceMatch[2][0] === fence[0] && line.trim() === fence)
        fence = null
      continue
    }
    if (fenceMatch) {
      fence = fenceMatch[2]
      continue
    }
    if (line.trim() === '---') {
      close = i
      break
    }
  }
  if (close === -1) return null

  const raw = lines.slice(1, close).join(eol)
  const body = lines.slice(close + 1).join(eol)
  return { raw, body, eol, bom }
}

/** Serialize frontmatter with the original line ending and BOM. */
export function serializeFrontmatter(
  raw: string,
  body: string,
  eol = '\n',
  bom = '',
): string {
  return `${bom}---${eol}${raw}${eol}---${eol}${body}`
}

export function replaceFrontmatterField(
  fm: string,
  from: string,
  to: string,
): string {
  return fm.replace(new RegExp(`^([ \\t]*)${from}[ \\t]*:`, 'm'), `$1${to}:`)
}

export function hasFrontmatterField(fm: string, key: string): boolean {
  return new RegExp(`^[ \\t]*${key}[ \\t]*:`, 'm').test(fm)
}

export function getFrontmatterScalar(fm: string, key: string): string | null {
  const m = fm.match(
    new RegExp(`^[ \\t]*${key}[ \\t]*:[ \\t]*(.+?)[ \\t]*$`, 'm'),
  )
  if (!m) return null
  return m[1].trim().replace(/^['"`]|['"`]$/g, '')
}

/**
 * Renders a scalar as a TypeScript literal using the repo's single quotes.
 * Escapes backslashes, quotes and line breaks so generated configs stay valid.
 */
export function jsonScalar(value: unknown): string {
  if (typeof value === 'string') {
    const escaped = value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\r/g, '\\r')
      .replace(/\n/g, '\\n')
    return `'${escaped}'`
  }
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value)
  return JSON.stringify(value)
}

export function findConfigFile(
  root: string,
  candidates: readonly string[],
): string | null {
  for (const name of candidates) {
    if (exists(path.join(root, name))) return name
  }
  return null
}

/**
 * Blank out JS/TS comments while preserving offsets and string literals.
 * A `//` inside a URL or a `title` mentioned in a comment must never be read
 * as configuration.
 */
export function stripComments(source: string): string {
  let out = ''
  let i = 0
  while (i < source.length) {
    const two = source.slice(i, i + 2)
    if (two === '//') {
      const end = source.indexOf('\n', i)
      const stop = end === -1 ? source.length : end
      out += ' '.repeat(stop - i)
      i = stop
      continue
    }
    if (two === '/*') {
      const end = source.indexOf('*/', i + 2)
      const stop = end === -1 ? source.length : end + 2
      out += source.slice(i, stop).replace(/[^\n]/g, ' ')
      i = stop
      continue
    }
    const ch = source[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      let j = i + 1
      while (j < source.length) {
        if (source[j] === '\\') {
          j += 2
          continue
        }
        if (source[j] === ch) {
          j++
          break
        }
        j++
      }
      out += source.slice(i, j)
      i = j
      continue
    }
    out += ch
    i++
  }
  return out
}

/** Simple `const NAME = 'literal'` declarations, used to resolve config fields. */
export function collectStringConstants(source: string): Map<string, string> {
  const clean = stripComments(source)
  const re =
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(['"`])([^'"`\n]+)\2/g
  const out = new Map<string, string>()
  for (const match of clean.matchAll(re)) out.set(match[1], match[3])
  return out
}

/** A config field whose value is not a literal the migrator can resolve. */
export interface UnresolvedConfigValue {
  key: string
  expression: string
  line: number
}

/**
 * Find config fields assigned an expression rather than a literal.
 *
 * A field like `title: process.env.TITLE` or `title: siteConfig.title` cannot
 * be read safely; reporting it is better than silently dropping the title.
 * Literals and identifiers resolvable through a simple string constant are
 * considered resolved.
 */
export function findUnresolvedConfigValues(
  source: string,
  keys: readonly string[],
): UnresolvedConfigValue[] {
  const clean = stripComments(source)
  const constants = collectStringConstants(source)
  const out: UnresolvedConfigValue[] = []

  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(
      `(?:^|[\\s,{])['"\`]?${escaped}['"\`]?[ \\t]*:[ \\t]*([^\\n,}\\]]+)`,
      'g',
    )
    for (const match of clean.matchAll(re)) {
      const expression = match[1].trim()
      if (!expression) continue
      const quoted = /^(['"`]).*\1$/.test(expression)
      const literal = /^(?:true|false|null|-?\d+(?:\.\d+)?)$/.test(expression)
      const resolvable =
        /^[A-Za-z_$][\w$]*$/.test(expression) && constants.has(expression)
      if (quoted || literal || resolvable) continue
      const index = match.index + match[0].indexOf(expression)
      out.push({
        key,
        expression,
        line: clean.slice(0, index).split('\n').length,
      })
    }
  }
  return out
}

/**
 * Read a scalar string field from a JS/TS config, accepting bare and quoted
 * keys (`title:` and `'title':`) and all three quote styles for the value.
 * Values assigned to a simple string constant are resolved as well.
 * Comments are ignored so a commented-out example cannot win over the real
 * value.
 */
export function pickField(
  source: string,
  key: string,
  constants = collectStringConstants(source),
): string | undefined {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `(?:^|[\\s,{])['"\`]?${escaped}['"\`]?[ \\t]*:[ \\t]*(?:['"\`]([^'"\`\\n]+)['"\`]|([A-Za-z_$][\\w$]*))`,
  )
  const match = stripComments(source).match(re)
  if (!match) return undefined
  return match[1] ?? constants.get(match[2])
}

/**
 * Returns the balanced `{ ... }` literal that follows `key:` in a JS/TS
 * config source. Strings and comments are skipped so braces inside URLs or
 * template literals cannot end the scan early.
 *
 * Config files are not parsed with a JS parser on purpose (this command runs
 * against projects whose toolchain may be broken), so every extraction that
 * uses this helper stays "best effort" and the generated config is always
 * reported for review.
 */
export function objectLiteralAfter(source: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`['"\`]?${escaped}['"\`]?\\s*:\\s*\\{`)
  const m = re.exec(stripComments(source))
  if (!m) return null
  const start = m.index + m[0].length - 1
  return balancedSlice(source, start, '{', '}')
}

/**
 * Object literal that follows a string literal in an array, e.g.
 * `['@docusaurus/plugin-content-docs', { path: 'documentation' }]`.
 */
export function objectAfterLiteral(
  source: string,
  literal: string,
): string | null {
  const index = stripComments(source).indexOf(literal)
  if (index === -1) return null
  const brace = source.indexOf('{', index + literal.length)
  if (brace === -1) return null
  return balancedSlice(source, brace, '{', '}')
}

/** Object literal used as an ES default export, e.g. `export default { … }`. */
export function defaultExportObject(source: string): string | null {
  const re = /\bexport\s+default\s*\{/
  const m = re.exec(stripComments(source))
  if (!m) return null
  const start = m.index + m[0].length - 1
  return balancedSlice(source, start, '{', '}')
}

/** Object literal assigned to a variable, e.g. `const sidebars = { … }`. */
export function objectAfterAssignment(
  source: string,
  name: string,
): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(?:^|[^\\w$])${escaped}[ \\t]*=[ \\t]*\\{`)
  const m = re.exec(stripComments(source))
  if (!m) return null
  const start = m.index + m[0].length - 1
  return balancedSlice(source, start, '{', '}')
}

/** Balanced `[ ... ]` version of {@link objectLiteralAfter}. */
export function arrayLiteralAfter(source: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`['"\`]?${escaped}['"\`]?\\s*:\\s*\\[`)
  const m = re.exec(stripComments(source))
  if (!m) return null
  const start = m.index + m[0].length - 1
  return balancedSlice(source, start, '[', ']')
}

function balancedSlice(
  source: string,
  openIndex: number,
  open: string,
  close: string,
): string | null {
  let depth = 0
  let quote: string | null = null
  let lineComment = false
  let blockComment = false

  for (let i = openIndex; i < source.length; i++) {
    const ch = source[i]
    const next = source[i + 1]

    if (lineComment) {
      if (ch === '\n') lineComment = false
      continue
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false
        i++
      }
      continue
    }
    if (quote) {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === quote) quote = null
      continue
    }
    if (ch === '/' && next === '/') {
      lineComment = true
      i++
      continue
    }
    if (ch === '/' && next === '*') {
      blockComment = true
      i++
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return source.slice(openIndex, i + 1)
    }
  }
  return null
}

/** All simple `key: 'value'` pairs inside a literal returned by the helpers above. */
export function stringPairs(literal: string | null): Array<[string, string]> {
  if (!literal) return []
  const re = /['"`]?([\w$-]+)['"`]?\s*:\s*(['"`])([^'"`\n]+)\2/g
  return [...literal.matchAll(re)].map((m) => [m[1], m[3]])
}

/** A parsed `package.json` that the migrator mutates in place. */
export type JsonRecord = Record<string, unknown>

export interface ManifestPlan {
  /** Finding id, e.g. `docusaurus/deps`. */
  id: string
  title: string
  remediation: string
  /** True when the project has a source-framework config file. */
  hasSourceConfig?: boolean
  /** Which dependencies belong to the source framework. */
  isSourceDep: (name: string) => boolean
  /** Boltdocs packages to add when applying. */
  targetDeps: Record<string, string>
  /** Scripts to add or replace. */
  scripts: Record<string, string>
  /** Existing script values matching this are replaced as well. */
  replaceScriptsMatching?: RegExp
}

const DEP_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const

/** Whether any dependency block declares the named package. */
export function hasDependency(pkg: JsonRecord | null, name: string): boolean {
  return hasDependencyMatching(pkg, (key) => key === name)
}

/** Whether any dependency block has a key matching the predicate. */
export function hasDependencyMatching(
  pkg: JsonRecord | null,
  predicate: (name: string) => boolean,
): boolean {
  if (!pkg) return false
  return DEP_FIELDS.some((field) => {
    const block = asRecord(pkg[field])
    return block ? Object.keys(block).some(predicate) : false
  })
}

/**
 * Shared `package.json` migration for both external frameworks.
 *
 * Everything is derived from a declarative plan: no framework-specific code
 * touches the manifest, which keeps the two migrators small and makes the
 * rewrite identical in shape (remove source deps, add Boltdocs deps, set
 * scripts, serialize once).
 */
export function planPackageJson(
  root: string,
  apply: boolean,
  plan: ManifestPlan,
  findings: MigrationFinding[],
  applied: MigrationFinding[],
): void {
  const file = path.join(root, 'package.json')
  const pkg = readJsonRecord(file)
  if (!pkg) return

  const removed = removeDeps(pkg, plan.isSourceDep)
  const alreadyMigrated = hasDependency(pkg, 'boltdocs')
  if (removed.length === 0 && (alreadyMigrated || !plan.hasSourceConfig)) return

  const f = finding({
    id: plan.id,
    severity: 'blocking',
    action: 'fixable',
    title: plan.title,
    detail: removed.length
      ? `Found framework dependencies: ${removed.join(', ')}. Migration adds boltdocs, @bdocs/runtime, @bdocs/theme-neutral and the core plugins.`
      : 'A source-framework config is present but boltdocs is not declared. Migration adds the required packages and scripts.',
    file: 'package.json',
    remediation: plan.remediation,
  })
  findings.push(f)
  if (!apply) return

  const next = readJsonRecord(file)
  if (!next) return
  removeDeps(next, plan.isSourceDep)
  const deps = asStringRecord(next.dependencies) ?? {}
  for (const [name, version] of Object.entries(plan.targetDeps)) {
    if (!deps[name]) deps[name] = version
  }
  next.dependencies = deps

  const scripts = asStringRecord(next.scripts) ?? {}
  for (const [name, command] of Object.entries(plan.scripts)) {
    if (!scripts[name] || plan.replaceScriptsMatching?.test(scripts[name])) {
      scripts[name] = command
    }
  }
  next.scripts = scripts

  writeText(file, `${JSON.stringify(next, null, 2)}\n`)
  applied.push(f)
}

export function removeDeps(
  pkg: JsonRecord,
  predicate: (name: string) => boolean,
): string[] {
  const removed: string[] = []
  for (const field of DEP_FIELDS) {
    const deps = asRecord(pkg[field])
    if (!deps) continue
    for (const k of Object.keys(deps)) {
      if (predicate(k)) {
        delete deps[k]
        removed.push(k)
      }
    }
  }
  return [...new Set(removed)]
}
