import semver from 'semver'
import type { AuditFinding } from './types'

const REMOTE_DEP_RE = /^(?:git(?:\+[a-z]+)?|https?|file|link|ssh|github):/i

interface MetadataContext {
  name: string
  boltdocsVersion?: string
}

/**
 * Static checks against the plugin's own package.json. Never executes the
 * package's install scripts — it only reports their existence.
 */
export function auditPackageMetadata(
  pkg: Record<string, unknown>,
  context: MetadataContext = { name: 'plugin' },
): AuditFinding[] {
  const findings: AuditFinding[] = []

  const scripts = (pkg.scripts as Record<string, string> | undefined) || {}
  for (const scriptName of ['preinstall', 'install', 'postinstall']) {
    const script = scripts[scriptName]
    if (typeof script === 'string' && script.trim().length > 0) {
      findings.push({
        ruleId: 'install-script',
        category: 'metadata',
        severity: 'high',
        message: `Runs a ${scriptName} script during installation — a common supply-chain attack vector`,
        file: 'package.json',
        line: 0,
        snippet: `${scriptName}: ${script.trim().slice(0, 120)}`,
      })
    }
  }

  const bundled = pkg.bundledDependencies ?? pkg.bundleDependencies
  if (Array.isArray(bundled) && bundled.length > 0) {
    findings.push({
      ruleId: 'bundled-deps',
      category: 'metadata',
      severity: 'warning',
      message: `Bundles dependencies: ${(bundled as string[]).join(', ')} — vendored code that bypasses the registry audit`,
      file: 'package.json',
      line: 0,
      snippet: `bundledDependencies: [${(bundled as string[]).join(', ')}]`,
    })
  }

  const remoteDeps: string[] = []
  for (const depField of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    const deps = pkg[depField]
    if (!deps || typeof deps !== 'object') continue
    for (const [depName, spec] of Object.entries(
      deps as Record<string, string>,
    )) {
      if (typeof spec === 'string' && REMOTE_DEP_RE.test(spec)) {
        remoteDeps.push(`${depName}@${spec}`)
      }
    }
  }
  if (remoteDeps.length > 0) {
    findings.push({
      ruleId: 'remote-deps',
      category: 'metadata',
      severity: 'warning',
      message: `Dependencies loaded from non-registry sources (git/file/URL): ${remoteDeps.join(', ')}`,
      file: 'package.json',
      line: 0,
      snippet: remoteDeps.slice(0, 3).join(', '),
    })
  }

  if (!pkg.license && !pkg.licenses) {
    findings.push({
      ruleId: 'no-license',
      category: 'metadata',
      severity: 'low',
      message: 'Package declares no license',
      file: 'package.json',
      line: 0,
    })
  }

  if (!pkg.repository && !pkg.homepage) {
    findings.push({
      ruleId: 'no-provenance',
      category: 'metadata',
      severity: 'low',
      message:
        'Package declares no repository or homepage — harder to verify provenance',
      file: 'package.json',
      line: 0,
    })
  }

  if (context.boltdocsVersion && typeof pkg.version === 'string') {
    try {
      if (!semver.satisfies(pkg.version, context.boltdocsVersion)) {
        findings.push({
          ruleId: 'version-mismatch',
          category: 'metadata',
          severity: 'low',
          message: `Installed version ${pkg.version} does not satisfy the declared boltdocsVersion range ${context.boltdocsVersion}`,
          file: 'package.json',
          line: 0,
          snippet: `boltdocsVersion: ${context.boltdocsVersion}`,
        })
      }
    } catch {
      // invalid semver range — not our problem to flag
    }
  }

  return findings
}
