import { auditPlugins, type AuditPluginReport } from '../security/audit'
import {
  loadConfiguredPlugins,
  type AuditablePlugin,
} from '../security/audit/load-plugins'
import { SEVERITY_RANK } from '../security/audit/types'

/**
 * Minimal terminal renderer (deliberately dui-free).
 *
 * The audit command is the lightest CLI command, so it must not pay the cost
 * of importing the @bdocs/dui module graph. These helpers replicate the dui
 * surface used here (colors, loggers, boxed table) with the same default
 * theme colors and color-support detection.
 */
const COLOR_SUPPORTED =
  !('NO_COLOR' in process.env) && (process.stdout?.isTTY ?? false)

const ANSI_RE = /\u001b\[[0-9;]*m/g

function visibleLength(s: string): number {
  return s.replace(ANSI_RE, '').length
}

function colorize(code: number, s: string): string {
  return COLOR_SUPPORTED ? `\u001b[${code}m${s}\u001b[0m` : s
}

const colors = {
  red: (s: string) => colorize(31, s),
  yellow: (s: string) => colorize(33, s),
  cyan: (s: string) => colorize(36, s),
  green: (s: string) => colorize(32, s),
  gray: (s: string) => colorize(90, s),
  bold: (s: string) => colorize(1, s),
  dim: (s: string) => colorize(2, s),
}

const PREFIX = 'boltdocs'

function log(
  stream: 'stdout' | 'stderr',
  color: (s: string) => string,
  msg: string,
  extra?: unknown,
): void {
  // Leading newlines separate blocks visually; print them before the prefixed
  // line so they never produce an orphan `[boltdocs] ` prefix.
  const leading = msg.match(/^\n+/)?.[0] ?? ''
  const rest = msg.slice(leading.length)
  const line = `${colors.bold(`[${PREFIX}]`)} ${rest}`
  const out = stream === 'stderr' ? console.error : console.log
  if (leading) out(leading)
  out(color(line))
  if (extra !== undefined) out(extra)
}

const info = (msg: string) => log('stdout', colors.gray, msg)
const warn = (msg: string) => log('stdout', colors.yellow, msg)
const success = (msg: string) => log('stdout', colors.green, msg)
const error = (msg: string, err?: unknown) =>
  log('stderr', colors.red, msg, err)

/**
 * Boxed table matching dui's `single` border style. Columns are sized to the
 * visible (ANSI-stripped) width of their widest cell.
 */
function table(headers: string[], rows: string[][]): string {
  const colCount = Math.max(headers.length, ...rows.map((r) => r.length))
  const padding = 1
  const colWidths: number[] = []
  for (let c = 0; c < colCount; c++) {
    let max = headers[c] ? visibleLength(headers[c]) : 0
    for (const row of rows) max = Math.max(max, visibleLength(row[c] ?? ''))
    colWidths[c] = max + padding * 2
  }
  const b = {
    h: '─',
    v: '│',
    tl: '┌',
    tm: '┬',
    tr: '┐',
    ml: '├',
    mm: '┼',
    mr: '┤',
    bl: '└',
    bm: '┴',
    br: '┘',
  }
  const border = (l: string, m: string, r: string) =>
    l + colWidths.map((w) => b.h.repeat(w)).join(m) + r
  const rowLine = (cells: string[]) =>
    b.v +
    cells
      .map((cell, c) => {
        const text = cell ?? ''
        return (
          ' '.repeat(padding) +
          text +
          ' '.repeat(colWidths[c] - visibleLength(text) - padding)
        )
      })
      .join(b.v) +
    b.v
  const lines: string[] = [border(b.tl, b.tm, b.tr)]
  if (headers.length > 0) {
    lines.push(rowLine(headers.map((h) => colors.bold(h))))
    lines.push(border(b.ml, b.mm, b.mr))
  }
  for (const row of rows) lines.push(rowLine(row))
  lines.push(border(b.bl, b.bm, b.br))
  return lines.join('\n')
}

/** Pads a possibly ANSI-colored string to a fixed visual width. */
function pad(s: string, width: number): string {
  return s + ' '.repeat(Math.max(0, width - visibleLength(s)))
}

function severityLabel(report: AuditPluginReport): string {
  if (report.status === 'error') return '✖ Scan error'
  if (report.status === 'unresolved') return '❓ Unresolved'
  if (report.severity === 'high') return '⚠️ High risk'
  if (report.severity === 'warning') return '⚠️ Warning'
  if (report.severity === 'low') return 'ℹ️ Low risk'
  return '✅ Clean'
}

function severityColor(report: AuditPluginReport) {
  if (report.status === 'error') return colors.red
  if (report.severity === 'high') return colors.red
  if (report.severity === 'warning') return colors.yellow
  if (report.severity === 'low') return colors.cyan
  return colors.green
}

/**
 * Logic for the `boltdocs audit` command.
 *
 * The scan phase is pure static analysis: it reads plugin package.json files
 * and source files from node_modules but never requires, imports or executes
 * the scanned code. Note that loading the user's config (loadConfiguredPlugins)
 * does evaluate the config file itself, which may import plugin factory
 * modules — but no plugin hook, vite plugin or install script ever runs.
 */
export async function auditAction(root: string = process.cwd()): Promise<void> {
  info('Starting static security audit of Boltdocs plugins...')

  let plugins: AuditablePlugin[]
  try {
    const loaded = await loadConfiguredPlugins(root)
    plugins = loaded.plugins
  } catch (err) {
    error('Failed to load Boltdocs configuration for audit:', err)
    process.exit(1)
  }

  if (plugins.length === 0) {
    success('No plugins configured. Nothing to audit.')
    return
  }

  const reports = auditPlugins(plugins, root)

  const ordered = [...reports].sort(
    (a, b) =>
      SEVERITY_RANK[b.severity || 'low'] - SEVERITY_RANK[a.severity || 'low'] ||
      a.name.localeCompare(b.name),
  )

  for (const report of ordered) {
    const label = report.version
      ? `${report.name}@${report.version}`
      : report.name

    if (report.status === 'unresolved') {
      warn(
        `\n${colors.cyan(label)} — ${colors.yellow('❓ Unresolved')} (could not locate the package in node_modules)`,
      )
      continue
    }

    const summary =
      report.findings.length === 0
        ? 'no findings'
        : `${report.findings.length} finding${report.findings.length === 1 ? '' : 's'}`
    console.log(
      `\n${colors.bold(colors.cyan(label))} — ${severityColor(report)(severityLabel(report))} (${summary} · ${report.filesScanned} file${report.filesScanned === 1 ? '' : 's'} scanned)`,
    )

    const sortedFindings = [...report.findings].sort(
      (a, b) =>
        SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
        a.file.localeCompare(b.file) ||
        a.line - b.line,
    )
    for (const finding of sortedFindings) {
      const location =
        finding.file === 'package.json'
          ? 'package.json'
          : `${finding.file}:${finding.line}`
      const sevTag =
        finding.severity === 'high'
          ? colors.red(finding.severity)
          : finding.severity === 'warning'
            ? colors.yellow(finding.severity)
            : colors.dim(finding.severity)
      console.log(
        `  ${pad(colors.dim(location), 36)}${pad(sevTag, 9)}[${colors.dim(finding.category)}] ${colors.bold(finding.ruleId)} — ${finding.message}${finding.snippet ? colors.dim(`  (${finding.snippet})`) : ''}`,
      )
    }
  }

  console.log(
    '\n' +
      table(
        ['Plugin', 'Status', 'Findings'],
        ordered.map((r) => [
          r.name,
          severityLabel(r),
          r.status === 'unresolved' ? '—' : String(r.findings.length),
        ]),
      ) +
      '\n',
  )

  const hasErrors = ordered.some((r) => r.status === 'error')
  const hasUnresolved = ordered.some((r) => r.status === 'unresolved')
  const hasHigh = ordered.some((r) => r.severity === 'high')
  const hasWarnings = ordered.some((r) => r.findings.length > 0)
  const hasTruncated = ordered.some((r) =>
    r.findings.some((f) => f.ruleId === 'scan-truncated'),
  )

  if (hasErrors || hasUnresolved) {
    // Fail closed: a plugin that was never scanned must not count as passing.
    warn(
      '✖ One or more plugins could not be scanned (unresolved or scan error). Treat them as untrusted until they are re-audited.',
    )
  }
  // Independent of the fail-closed warning: a scanned plugin's HIGH-risk
  // findings must still be reported even when another plugin was unresolved.
  if (hasHigh) {
    warn(
      '⚠️  One or more plugins contain HIGH-risk findings (arbitrary code execution, sensitive file access). Review them before using the plugin.',
    )
  } else if (hasWarnings && !hasErrors && !hasUnresolved) {
    warn('⚠️  One or more plugins have findings. Review the details above.')
  }
  if (!hasErrors && !hasUnresolved && !hasHigh && !hasWarnings) {
    success('✓ All plugins passed the static security check!')
  }

  // CI contract: exit non-zero when the audit cannot vouch for every plugin.
  // `process.exitCode` (not `process.exit()`) so stdout flushes before exit.
  if (hasHigh || hasErrors || hasUnresolved || hasTruncated) {
    process.exitCode = 1
  }
}
