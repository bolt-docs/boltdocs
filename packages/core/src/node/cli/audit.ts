import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { resolveConfig } from '../config'
import { table, colors, info, warn, success, error } from '@bdocs/dui'

/**
 * Recursively scans a directory for JS/TS source files.
 */
function getPluginSourceFiles(dir: string): string[] {
  const results: string[] = []
  if (!fs.existsSync(dir)) return results

  try {
    const list = fs.readdirSync(dir)
    for (const file of list) {
      const fullPath = path.join(dir, file)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory()) {
        // Skip common large non-source directories
        if (
          file !== 'node_modules' &&
          file !== '.git' &&
          file !== 'dist' &&
          file !== 'coverage'
        ) {
          results.push(...getPluginSourceFiles(fullPath))
        }
      } else {
        // Only inspect JS, TS, and related extension files
        if (/\.(js|mjs|cjs|ts|tsx|jsx)$/.test(file)) {
          results.push(fullPath)
        }
      }
    }
  } catch (err) {
    // Ignore read errors
  }

  return results
}

interface AuditResult {
  name: string
  status: string
  details: string
}

/**
 * Logic for the `boltdocs audit` command.
 * Performs a static code analysis scan of installed plugins.
 */
export async function auditAction(root: string = process.cwd()): Promise<void> {
  info('Starting static security audit of Boltdocs plugins...')

  let config
  try {
    config = await resolveConfig(path.resolve(root, 'docs'), root)
  } catch (err) {
    error('Failed to load Boltdocs configuration for audit:', err)
    process.exit(1)
  }

  const plugins = config.plugins || []
  if (plugins.length === 0) {
    success('No plugins configured. Nothing to audit.')
    return
  }

  const results: AuditResult[] = []

  for (const plugin of plugins) {
    if (!plugin.name) continue

    let pluginDir: string | null = null

    // Find the plugin dir
    try {
      const localRequire = createRequire(path.resolve(root, 'package.json'))
      const pkgJsonPath = localRequire.resolve(`${plugin.name}/package.json`)
      pluginDir = path.dirname(pkgJsonPath)
    } catch (e) {
      const localPath = path.resolve(root, 'node_modules', plugin.name)
      if (fs.existsSync(localPath)) {
        pluginDir = localPath
      }
    }

    if (!pluginDir) {
      results.push({
        name: colors.cyan(plugin.name),
        status: colors.red('❓ Unresolved'),
        details: 'Could not locate plugin files in node_modules.',
      })
      continue
    }

    // Scan source files
    const files = getPluginSourceFiles(pluginDir)
    const findings: string[] = []

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8')

        if (content.includes('fetch(')) findings.push('fetch')
        if (content.includes('axios')) findings.push('axios')
        if (content.includes('http.request')) findings.push('http.request')
        if (content.includes('https.request')) findings.push('https.request')
        if (content.includes('process.env')) findings.push('process.env')
      } catch (err) {
        // ignore unreadable files
      }
    }

    const uniqueFindings = Array.from(new Set(findings))

    if (uniqueFindings.length > 0) {
      results.push({
        name: colors.cyan(plugin.name),
        status: colors.yellow('⚠️ Warning'),
        details: `Contains network/env accesses: ${colors.bold(uniqueFindings.join(', '))}. Ensure you trust the author.`,
      })
    } else {
      results.push({
        name: colors.cyan(plugin.name),
        status: colors.green('✅ Clean'),
        details: 'No external network calls or env accesses detected.',
      })
    }
  }

  // Render results
  const headers = ['Plugin', 'Status', 'Audit Notes']
  const rows = results.map((r) => [r.name, r.status, r.details])

  console.log('\n' + table(headers, rows) + '\n')

  const hasWarnings = results.some((r) => r.status.includes('Warning'))
  if (hasWarnings) {
    warn(
      '⚠️  One or more plugins have security warnings. Review the flags above.',
    )
  } else {
    success('✓ All plugins passed the static security check!')
  }
}
