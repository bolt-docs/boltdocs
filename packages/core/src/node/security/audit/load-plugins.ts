import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { CONFIG_FILES } from '../../config-files'

export interface AuditablePlugin {
  name?: string
  version?: string
  boltdocsVersion?: string
  /**
   * Real package name, matched from the config's static import specifiers.
   * Plugin `name` fields often differ from package names
   * (`boltdocs-plugin-mermaid` vs `@bdocs/plugin-mermaid`).
   */
  packageName?: string
}

export interface LoadedPlugins {
  plugins: AuditablePlugin[]
  /** Path of the config file that was found, if any. */
  configFile?: string
}

interface RawConfigModule {
  default?: Record<string, unknown>
  config?: Record<string, unknown>
}

interface PackageCandidate {
  pkgName: string
  version?: string
}

/**
 * Static imports in the config (`import x from 'pkg'`) are the only reliable
 * link between a configured plugin and its installed package. We collect
 * those specifiers and resolve each one to a package.json — without
 * executing or importing anything.
 */
const IMPORT_SPECIFIER_RE = /from\s+(['"])([^'"]+)\1/g

function collectImportSpecifiers(source: string): string[] {
  const out: string[] = []
  IMPORT_SPECIFIER_RE.lastIndex = 0
  for (
    let match = IMPORT_SPECIFIER_RE.exec(source);
    match !== null;
    match = IMPORT_SPECIFIER_RE.exec(source)
  ) {
    out.push(match[2])
  }
  return out
}

/** Last path segment of a package name: `@bdocs/plugin-math` → `plugin-math`. */
function baseName(pkgName: string): string {
  const slash = pkgName.lastIndexOf('/')
  return slash >= 0 ? pkgName.slice(slash + 1) : pkgName
}

/**
 * Scores how likely a package produced a given plugin object. Exact package
 * names win, then unscoped base-name matches, then prefixed names
 * (`boltdocs-plugin-math` ends with `plugin-math`). Version equality breaks
 * ties between equal primary matches.
 */
function matchScore(
  pluginName: string,
  candidate: PackageCandidate,
  pluginVersion?: string,
): number {
  let score = 0
  if (candidate.pkgName === pluginName) {
    score = 100
  } else {
    const base = baseName(candidate.pkgName)
    if (base === pluginName) {
      score = 60
    } else if (pluginName.endsWith(base)) {
      score = 40
    }
  }
  if (score > 0 && pluginVersion && candidate.version === pluginVersion) {
    score += 15
  }
  return score
}

/** Resolves every static import specifier of the config to a package candidate. */
function resolveCandidates(
  configPath: string,
  root: string,
): PackageCandidate[] {
  let source: string
  try {
    source = fs.readFileSync(configPath, 'utf-8')
  } catch {
    return []
  }
  const localRequire = createRequire(configPath)
  const candidates: PackageCandidate[] = []
  const seen = new Set<string>()
  for (const spec of collectImportSpecifiers(source)) {
    if (spec.startsWith('.') || spec.startsWith('/')) continue
    let pkgPath: string | null = null
    try {
      pkgPath = localRequire.resolve(`${spec}/package.json`)
    } catch {
      const direct = path.resolve(root, 'node_modules', spec, 'package.json')
      if (fs.existsSync(direct)) pkgPath = direct
    }
    if (!pkgPath || !fs.existsSync(pkgPath)) continue
    let pkg: Record<string, unknown>
    try {
      pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as Record<
        string,
        unknown
      >
    } catch {
      continue
    }
    const pkgName = typeof pkg.name === 'string' ? pkg.name : spec
    // Never bind a plugin to the framework itself (imported for defineConfig).
    if (pkgName === 'boltdocs') continue
    if (seen.has(pkgName)) continue
    seen.add(pkgName)
    candidates.push({
      pkgName,
      version: typeof pkg.version === 'string' ? pkg.version : undefined,
    })
  }
  return candidates
}

/**
 * Pairs each configured plugin with the package that produced it (via the
 * config's static imports) so the audit scans the right directory even when
 * the plugin `name` and the package name differ. Plugins that cannot be
 * matched keep the legacy name-based resolution.
 */
function matchPluginPackages(
  configPath: string,
  root: string,
  plugins: AuditablePlugin[],
): void {
  if (plugins.length === 0) return
  const candidates = resolveCandidates(configPath, root)
  if (candidates.length === 0) return

  for (const plugin of plugins) {
    if (!plugin || typeof plugin.name !== 'string' || !plugin.name) continue
    let best: PackageCandidate | null = null
    let bestScore = 0
    for (const candidate of candidates) {
      const score = matchScore(plugin.name, candidate, plugin.version)
      if (score > bestScore) {
        bestScore = score
        best = candidate
      }
    }
    if (best) plugin.packageName = best.pkgName
  }
}

/**
 * Lightweight config loader used by the `audit` command.
 *
 * It resolves the user's `boltdocs.config.{js,mjs,ts}` via jiti and returns
 * only `config.plugins`. It deliberately skips the full `resolveConfig`
 * pipeline (Zod schema validation, default merging, config caching) so the
 * audit does not pay for loading zod/schema — the audit only needs the
 * plugin list, and the engine validates plugin entries itself.
 *
 * Like `resolveConfig`, it evaluates the user's own config file (jiti). A
 * config that imports its plugins (`import mermaid from '@bdocs/plugin-x'`)
 * will also execute those plugin factory modules as part of that evaluation —
 * this is inherent to reading the plugin list from an executed config. What
 * the audit guarantees is that the SCAN phase that follows is purely static:
 * the scanned package sources are read, never imported or executed, and no
 * plugin hook, vite plugin or install script ever runs.
 *
 * It mirrors `resolveConfig`'s fall-through: a broken config file is skipped
 * in favor of the next supported filename.
 */
export async function loadConfiguredPlugins(
  root: string,
): Promise<LoadedPlugins> {
  let lastError: unknown

  for (const filename of CONFIG_FILES) {
    const configPath = path.resolve(root, filename)
    if (!fs.existsSync(configPath)) continue

    try {
      const { createJiti } = await import('jiti')
      const jiti = createJiti(root, { interopDefault: true })
      const loaded = (await jiti.import(configPath)) as RawConfigModule
      const mod = loaded ?? {}
      const userConfig =
        mod.default ?? mod.config ?? (mod as Record<string, unknown>)

      if (!userConfig || typeof userConfig !== 'object') {
        throw new Error('config file did not export an object')
      }
      if (!('plugins' in userConfig)) {
        return { plugins: [], configFile: configPath }
      }
      if (!Array.isArray(userConfig.plugins)) {
        throw new Error(
          `config.plugins must be an array, got ${typeof userConfig.plugins}`,
        )
      }
      const plugins = userConfig.plugins as AuditablePlugin[]
      matchPluginPackages(configPath, root, plugins)
      return { plugins, configFile: configPath }
    } catch (err) {
      // Try the next supported filename, like resolveConfig does.
      lastError = err
    }
  }

  if (lastError !== undefined) {
    throw new Error(
      `Failed to load Boltdocs configuration: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
      { cause: lastError },
    )
  }

  return { plugins: [] }
}
