import fs from 'node:fs'
import path from 'node:path'
import { selectShippedFiles } from './scope'
import {
  AUDIT_IMPORT_RULES,
  AUDIT_RULES,
  COMPOUND_RULES,
  FS_READ_RE,
  FS_WRITE_RE,
  QUICK_REJECT_RE,
  REMOTE_IMPORT_RE,
  SENSITIVE_PATH_RE,
} from './rules'
import type {
  AuditCategory,
  AuditFinding,
  AuditOptions,
  AuditRule,
  AuditSeverity,
} from './types'
import { DEFAULT_MAX_FILES, DEFAULT_MAX_TOTAL_BYTES } from './types'

/**
 * Per-file lexical state that spans lines (block comments and template
 * literals can span multiple lines in JS/TS).
 */
interface LineState {
  inBlockComment: boolean
  inTemplate: boolean
}

function isImportContext(code: string): boolean {
  return (
    /\b(?:require|import)\s*\(\s*$/.test(code) ||
    /\b(?:from|import)\s+$/.test(code)
  )
}

/** Decodes \xNN / \uNNNN escapes in a captured module specifier. */
function unescapeSpecifier(spec: string): string {
  return spec
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, h: string) =>
      String.fromCharCode(Number.parseInt(h, 16)),
    )
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h: string) =>
      String.fromCharCode(Number.parseInt(h, 16)),
    )
}

/**
 * A single-pass, stateful line processor that produces two views of the line:
 *
 * - `code`: comments, strings, templates and regex literals removed. Used by
 *   structural rules (call sites, property access).
 * - `raw`: comments removed but string literals kept. Used by rules whose
 *   evidence lives inside a string (e.g. `Buffer.from(x, 'base64')`).
 *
 * Comment stripping is string-aware: `const url = "https://x"` keeps its
 * string intact because `//` inside a quoted string is not a comment.
 *
 * Module specifiers are captured **in code mode only**: a string is treated
 * as an import specifier when it opens immediately after `require(` /
 * `import(` / `from ` / `import `. Strings that merely *contain* text like
 * `require('child_process')` never trigger import rules.
 */
function processLine(
  line: string,
  state: LineState,
): { code: string; raw: string; imports: string[] } {
  let code = ''
  let raw = ''
  let i = 0
  let mode: 'code' | 'single' | 'double' | 'template' | 'block'
  if (state.inBlockComment) mode = 'block'
  else if (state.inTemplate) mode = 'template'
  else mode = 'code'

  const imports: string[] = []
  let pendingSpecifier: string | null = null

  const closeSpecifier = () => {
    if (pendingSpecifier !== null) {
      // strip the closing quote that was appended with the content
      imports.push(unescapeSpecifier(pendingSpecifier.slice(0, -1)))
      pendingSpecifier = null
    }
  }

  while (i < line.length) {
    const ch = line[i]
    const next = line[i + 1]

    if (mode === 'block') {
      // comments are removed from both views
      if (ch === '*' && next === '/') {
        i += 2
        mode = 'code'
      } else {
        i++
      }
      continue
    }
    if (mode === 'single' || mode === 'double' || mode === 'template') {
      // string content is kept in `raw` (escapes intact) but blanked in `code`
      if (ch === '\\' && next !== undefined) {
        if (pendingSpecifier !== null) pendingSpecifier += ch + next
        raw += ch + next
        code += '  '
        i += 2
        continue
      }
      if (pendingSpecifier !== null) pendingSpecifier += ch
      raw += ch
      code += ' '
      i++
      if (mode === 'single' && ch === "'") {
        mode = 'code'
        closeSpecifier()
      } else if (mode === 'double' && ch === '"') {
        mode = 'code'
        closeSpecifier()
      } else if (mode === 'template' && ch === '`') {
        mode = 'code'
        closeSpecifier()
      }
      continue
    }

    // code mode
    if (ch === '/' && next === '/') {
      i = line.length // line comment consumes the rest
      continue
    }
    if (ch === '/' && next === '*') {
      i += 2
      mode = 'block'
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      const isSpecifier = pendingSpecifier === null && isImportContext(code)
      raw += ch
      code += ' '
      i++
      if (ch === "'") mode = 'single'
      else if (ch === '"') mode = 'double'
      else mode = 'template'
      if (isSpecifier) pendingSpecifier = ''
      continue
    }
    if (ch === '/' && isRegexStart(code)) {
      // regex literal: blank it from both views
      let j = i + 1
      let inClass = false
      while (j < line.length) {
        const c = line[j]
        if (c === '\\') {
          j += 2
          continue
        }
        if (c === '[') inClass = true
        else if (c === ']') inClass = false
        else if (c === '/' && !inClass) break
        j++
      }
      let k = j < line.length ? j + 1 : line.length
      while (k < line.length && /[dgimsuvy]/.test(line[k])) k++
      code += ' '.repeat(k - i)
      raw += ' '.repeat(k - i)
      i = k
      continue
    }
    code += ch
    raw += ch
    i++
  }

  state.inBlockComment = mode === 'block'
  state.inTemplate = mode === 'template'

  return { code, raw, imports }
}

/**
 * Heuristic: does `/` at the current position start a regex literal?
 * Checks the last non-whitespace character of the code emitted so far and a
 * small set of keyword contexts. Division after an identifier or `)` is
 * (conservatively) treated as division, which keeps false positives low.
 */
function isRegexStart(code: string): boolean {
  let k = code.length - 1
  while (k >= 0 && /\s/.test(code[k])) k--
  if (k < 0) return true
  if ('(=,:[;!&|?{'.includes(code[k])) return true
  const before = code.slice(0, k + 1)
  return /\b(?:return|typeof|instanceof|in|of|new|case|void|delete|do|else|yield)\s*$/.test(
    before,
  )
}

function normalizeImportSpecifier(spec: string): string {
  return spec.replace(/^node:/, '')
}

/**
 * Reads only the first `maxBytes` bytes of a file. Used to scan the head of a
 * file that crosses the total byte budget without loading the whole file.
 */
function readFileHead(absFile: string, maxBytes: number): string | null {
  try {
    const fd = fs.openSync(absFile, 'r')
    try {
      // Uint8Array<ArrayBuffer> is assignable to readSync's buffer view on
      // both @types/node 22 (non-generic Buffer) and 25 (generic Buffer).
      const buf = new Uint8Array(maxBytes)
      const read = fs.readSync(fd, buf, 0, maxBytes, 0)
      let text = Buffer.from(buf.subarray(0, read)).toString('utf-8')
      // Trim to the last newline so the boundary never splits a multi-byte
      // character or leaves a half-line (also keeps line numbers accurate).
      const lastLf = text.lastIndexOf('\n')
      if (lastLf !== -1) text = text.slice(0, lastLf)
      return text
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return null
  }
}

export interface ScanResult {
  findings: AuditFinding[]
  filesScanned: number
}

/**
 * Static-only scan of a plugin package. Reads file contents with
 * `fs.readFileSync` and never requires/imports/executes plugin code.
 */
export function scanPluginCode(
  pluginDir: string,
  pkg: Record<string, unknown>,
  options: AuditOptions = {},
): ScanResult {
  const maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES
  const maxTotalBytes = options.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES
  const files = selectShippedFiles(pluginDir, pkg, maxFiles)
  const findings: AuditFinding[] = []
  const seen = new Set<string>()
  let filesScanned = 0

  const addFinding = (
    ruleId: string,
    category: AuditCategory,
    severity: AuditSeverity,
    message: string,
    file: string,
    line: number,
    snippet?: string,
    extra = '',
  ) => {
    const key = `${ruleId}|${file}|${line}|${extra}`
    if (seen.has(key)) return
    seen.add(key)
    findings.push({
      ruleId,
      category,
      severity,
      message,
      file,
      line,
      snippet,
    })
  }

  /** Scans the lines of a single file's content, emitting findings. */
  const scanContent = (content: string, relFile: string): void => {
    const lines = content.split('\n')
    const state: LineState = { inBlockComment: false, inTemplate: false }

    for (let idx = 0; idx < lines.length; idx++) {
      const original = lines[idx]
      const { code, raw, imports } = processLine(original, state)
      const lineNo = idx + 1
      const snippet = original.trim().slice(0, 120)

      // Fast path: most lines are clean. If the line contains none of the
      // literal anchors shared by every rule, skip the whole catalog.
      // (`raw` is a superset of `code`, so one test covers both layers.)
      if (QUICK_REJECT_RE.test(raw)) {
        const matchedRules: AuditRule[] = []
        for (const rule of AUDIT_RULES) {
          const target = rule.layer === 'raw' ? raw : code
          if (
            rule.pattern.test(target) &&
            (!rule.codeGuard || rule.codeGuard.test(code))
          ) {
            matchedRules.push(rule)
          }
        }
        const hasNewFunction = matchedRules.some((r) => r.id === 'new-function')
        for (const rule of matchedRules) {
          // `new Function(` already reported by `new-function`; skip the
          // redundant `function-constructor` hit on the same construct.
          if (hasNewFunction && rule.id === 'function-constructor') continue
          addFinding(
            rule.id,
            rule.category,
            rule.severity,
            rule.description,
            relFile,
            lineNo,
            snippet,
          )
        }

        // Compound: fs operations targeting sensitive locations. Matched on
        // the `raw` layer (to include require('fs') aliases) but gated on a
        // `code` signal so string literals containing fs code do not
        // false-positive.
        if (SENSITIVE_PATH_RE.test(raw) && /\b(?:fs|require)\b/.test(code)) {
          if (FS_WRITE_RE.test(raw)) {
            const c = COMPOUND_RULES['fs-write-sensitive']
            addFinding(
              'fs-write-sensitive',
              c.category,
              c.severity,
              c.message,
              relFile,
              lineNo,
              snippet,
            )
          }
          if (FS_READ_RE.test(raw)) {
            const c = COMPOUND_RULES['fs-read-sensitive']
            addFinding(
              'fs-read-sensitive',
              c.category,
              c.severity,
              c.message,
              relFile,
              lineNo,
              snippet,
            )
          }
        }
      }

      for (const spec of imports) {
        if (REMOTE_IMPORT_RE.test(spec)) {
          addFinding(
            'remote-code-import',
            'dynamic-code',
            'high',
            `Loads code from a remote URL at runtime: ${spec.slice(0, 80)}`,
            relFile,
            lineNo,
            snippet,
            spec,
          )
          continue
        }
        const normalized = normalizeImportSpecifier(spec)
        for (const importRule of AUDIT_IMPORT_RULES) {
          if (importRule.modules.includes(normalized)) {
            addFinding(
              importRule.id,
              importRule.category,
              importRule.severity,
              importRule.description,
              relFile,
              lineNo,
              snippet,
              spec,
            )
            break
          }
        }
      }
    }
  }

  let totalBytes = 0
  let truncated = false

  for (const absFile of files) {
    const relFile = path.relative(pluginDir, absFile)

    // Enforce the total byte budget across the whole package. A single
    // pathological file (e.g. a huge minified bundle) must not dominate the
    // scan; when the cap lands inside a file, scan only its head.
    let size: number
    try {
      size = fs.statSync(absFile).size
    } catch {
      continue
    }
    const remaining = maxTotalBytes - totalBytes
    if (size > remaining) {
      if (remaining > 0) {
        const head = readFileHead(absFile, remaining)
        if (head !== null) {
          filesScanned++
          scanContent(head, relFile)
        }
      }
      truncated = true
      break
    }

    let content: string
    try {
      content = fs.readFileSync(absFile, 'utf-8')
    } catch {
      continue
    }
    filesScanned++
    totalBytes += size
    scanContent(content, relFile)
  }

  // Fail closed: an incomplete scan must never be reported as clean.
  if (truncated) {
    addFinding(
      'scan-truncated',
      'metadata',
      'warning',
      `Scan truncated at ${maxTotalBytes} bytes — remaining files were not inspected. Increase maxTotalBytes to audit the full package.`,
      'package.json',
      0,
    )
  }

  return { findings, filesScanned }
}
