/**
 * Shared types for the static plugin audit engine.
 *
 * The audit is a **read-only** static analysis: it never requires, imports,
 * or executes plugin code. Everything in this module works on file contents.
 */

export type AuditSeverity = 'high' | 'warning' | 'low'

export type AuditCategory =
  | 'process'
  | 'dynamic-code'
  | 'network'
  | 'filesystem'
  | 'env-secrets'
  | 'metadata'

/**
 * Which line layer a rule runs against:
 * - `code`: comments, strings, templates and regex literals removed.
 *   Structural patterns (call sites, property access) match here.
 * - `raw`: comments removed, string literals kept. Patterns that need the
 *   string content as evidence (e.g. `Buffer.from(x, 'base64')`) match here.
 */
export type AuditRuleLayer = 'code' | 'raw'

export interface AuditRule {
  id: string
  category: AuditCategory
  severity: AuditSeverity
  description: string
  layer: AuditRuleLayer
  /** Tested against each line of the rule's layer. */
  pattern: RegExp
  /**
   * For `raw`-layer rules: the `code` layer must also match this guard, so
   * that patterns embedded in plain string literals (e.g.
   * `"process.env['API_SECRET']"`) do not false-positive.
   */
  codeGuard?: RegExp
}

export interface AuditImportRule {
  id: string
  category: AuditCategory
  severity: AuditSeverity
  description: string
  /** Module names to match (after stripping a `node:` prefix). */
  modules: string[]
}

export interface AuditFinding {
  ruleId: string
  category: AuditCategory
  severity: AuditSeverity
  message: string
  /** Relative path inside the plugin package (e.g. `dist/index.js`). */
  file: string
  /** 1-based line number; `0` when not applicable (e.g. package.json metadata). */
  line: number
  /** Trimmed original source line, when available. */
  snippet?: string
}

export type PluginAuditStatus = 'clean' | 'warning' | 'unresolved' | 'error'

export interface AuditPluginReport {
  name: string
  status: PluginAuditStatus
  /** Highest severity among findings. */
  severity?: AuditSeverity
  pluginDir?: string
  version?: string
  filesScanned: number
  findings: AuditFinding[]
}

export interface AuditOptions {
  /** Cap on the number of files scanned per plugin. */
  maxFiles?: number
  /**
   * Cap on the total number of source bytes scanned per plugin. Protects
   * against pathological single files (e.g. multi-megabyte minified bundles)
   * dominating the scan. When the cap is hit, the scan stops and a
   * `scan-truncated` finding is emitted so the plugin is never reported as
   * clean based on an incomplete scan.
   */
  maxTotalBytes?: number
}

export const DEFAULT_MAX_FILES = 300

export const DEFAULT_MAX_TOTAL_BYTES = 8 * 1024 * 1024

export const SEVERITY_RANK: Record<AuditSeverity, number> = {
  high: 3,
  warning: 2,
  low: 1,
}

export function highestSeverity(
  severities: AuditSeverity[],
): AuditSeverity | undefined {
  let best: AuditSeverity | undefined
  for (const s of severities) {
    if (!best || SEVERITY_RANK[s] > SEVERITY_RANK[best]) best = s
  }
  return best
}
