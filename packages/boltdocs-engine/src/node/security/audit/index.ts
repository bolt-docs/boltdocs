import { resolvePluginPackage } from './resolve'
import { scanPluginCode, type ScanResult } from './scanner'
import { auditPackageMetadata } from './metadata'
import type { AuditFinding, AuditOptions, AuditPluginReport } from './types'
import { highestSeverity } from './types'

export type {
  AuditFinding,
  AuditImportRule,
  AuditOptions,
  AuditPluginReport,
  AuditRule,
} from './types'
export { AUDIT_RULES, AUDIT_IMPORT_RULES } from './rules'
export { resolvePluginPackage } from './resolve'
export { selectShippedFiles } from './scope'
export { scanPluginCode } from './scanner'
export { auditPackageMetadata } from './metadata'

export interface AuditablePlugin {
  name?: string
  version?: string
  boltdocsVersion?: string
  /** Real package name (from the config's import specifiers) if it differs from `name`. */
  packageName?: string
}

/**
 * Audits a single configured plugin. The whole pipeline is read-only static
 * analysis: plugin packages are never imported or executed.
 */
export function auditPlugin(
  name: string,
  root: string,
  options: AuditOptions = {},
  pluginConfig?: AuditablePlugin,
): AuditPluginReport {
  const resolved = resolvePluginPackage(pluginConfig?.packageName ?? name, root)

  if (!resolved) {
    return {
      name,
      status: 'unresolved',
      filesScanned: 0,
      findings: [],
    }
  }

  let scan: ScanResult
  try {
    scan = scanPluginCode(resolved.dir, resolved.pkg, options)
  } catch (err) {
    // Fail closed: a broken scan must never report the plugin as clean.
    return {
      name,
      status: 'error',
      pluginDir: resolved.dir,
      version: resolved.version,
      filesScanned: 0,
      findings: [
        {
          ruleId: 'scan-error',
          category: 'metadata',
          severity: 'warning',
          message: `Static scan failed: ${err instanceof Error ? err.message : String(err)}`,
          file: 'package.json',
          line: 0,
        },
      ],
    }
  }

  const findings: AuditFinding[] = [...scan.findings]

  findings.push(
    ...auditPackageMetadata(resolved.pkg, {
      name,
      boltdocsVersion: pluginConfig?.boltdocsVersion,
    }),
  )

  const severity = highestSeverity(findings.map((f) => f.severity))

  return {
    name,
    status: findings.length === 0 ? 'clean' : 'warning',
    severity,
    pluginDir: resolved.dir,
    version: resolved.version,
    filesScanned: scan.filesScanned,
    findings,
  }
}

/**
 * Audits every configured plugin, preserving config order.
 */
export function auditPlugins(
  plugins: AuditablePlugin[],
  root: string,
  options: AuditOptions = {},
): AuditPluginReport[] {
  const reports: AuditPluginReport[] = []
  for (const plugin of plugins) {
    if (!plugin || typeof plugin.name !== 'string' || !plugin.name) continue
    reports.push(auditPlugin(plugin.name, root, options, plugin))
  }
  return reports
}
