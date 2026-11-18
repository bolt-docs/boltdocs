import { auditPlugins } from './index'
import { loadConfiguredPlugins } from './load-plugins'
import type { AuditPluginReport } from './types'
import type { AuditablePlugin } from './index'

/**
 * Build/dev preflight for SPEC §2.3.
 *
 * `boltdocs audit` used to be a standalone command, so a project could build
 * and serve plugins that had never been scanned. This guard runs the same
 * static analysis before the pipeline starts and refuses to continue when a
 * plugin could not be scanned, contains high-risk calls, or was only partially
 * scanned. No plugin code is imported or executed by the scan itself.
 */
export class PluginAuditError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PluginAuditError'
  }
}

function describe(
  report: AuditPluginReport,
  allowWarnings: readonly string[],
): string | null {
  if (report.status === 'unresolved')
    return `${report.name}: could not be located`
  if (report.status === 'error') return `${report.name}: scan failed`
  if (report.severity === 'high') return `${report.name}: high-risk findings`
  if (report.findings.some((finding) => finding.ruleId === 'scan-truncated')) {
    return `${report.name}: scan was truncated`
  }
  // SPEC §2.3: a risky call blocks until resolved. Warnings count too; a site
  // can accept them per plugin through an explicit, auditable allowlist.
  if (
    (report.severity === 'warning' || report.severity === 'high') &&
    !allowWarnings.includes(report.name)
  ) {
    return `${report.name}: unreviewed risky finding(s)`
  }
  return null
}

/** Pure guard so the rule can be tested without touching the filesystem. */
export function assertReportsSafe(
  reports: AuditPluginReport[],
  allowWarnings: readonly string[] = [],
): void {
  const blockers = reports
    .map((report) => describe(report, allowWarnings))
    .filter((reason): reason is string => reason !== null)
  if (blockers.length > 0) {
    throw new PluginAuditError(
      `Plugin audit failed; resolve these before building or serving:\n  - ${blockers.join('\n  - ')}`,
    )
  }
}

/** Load the configured plugins, scan them statically, and fail closed. */
export async function preflightAudit(root: string): Promise<void> {
  let plugins: AuditablePlugin[]
  let allowWarnings: string[] = []
  try {
    const loaded = await loadConfiguredPlugins(root)
    plugins = loaded.plugins
    allowWarnings = loaded.auditAllowWarnings ?? []
  } catch (error) {
    throw new PluginAuditError(
      `Could not load plugin configuration for audit: ${
        error instanceof Error ? error.message : String(error)
      }`,
    )
  }
  assertReportsSafe(auditPlugins(plugins, root), allowWarnings)
}
