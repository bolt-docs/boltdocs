import path from 'path'
import fs from 'fs'
import { fdir } from 'fdir'
import picomatch from 'picomatch'
import { resolveConfig } from '../../config'
import * as ui from '../ui'
import { notifyUpdateAvailable } from '../../update-check'
import {
  type DoctorContext,
  type DoctorIssue,
  DEFAULT_DOCTOR_CONFIG,
} from './types'
import {
  generateLinkTree,
  loadDoctorConfig,
  getFileData,
  backupFile,
  fileExistsCache,
} from './utils'
import { checkMetadata, checkLinks, checkI18n, checkSidebar } from './checkers'

export * from './types'
export { generateLinkTree, loadDoctorConfig }
export { checkMetadata, checkLinks, checkI18n, checkSidebar }

/**
 * Initialize doctor.json with default configuration.
 */
export async function doctorInit(root: string) {
  const configPath = path.resolve(root, 'doctor.json')
  if (fs.existsSync(configPath)) {
    ui.warn(`"doctor.json" already exists at ${root}.`)
    return
  }

  try {
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_DOCTOR_CONFIG, null, 2))
    ui.success(`Created "doctor.json" with default configuration.`)
  } catch (e) {
    ui.error(`Failed to create "doctor.json": ${e}`)
  }
}

/**
 * Main doctor entry point.
 */
export async function doctorAction(
  root: string = process.cwd(),
  options: { fix?: boolean; checkExternal?: boolean; init?: boolean } = {},
) {
  if (options.init) {
    await doctorInit(root)
    return
  }

  notifyUpdateAvailable()

  try {
    const doctorConfig = await loadDoctorConfig(root)
    const { format: reportFormat } = doctorConfig.reporting
    const { colors } = ui

    if (reportFormat === 'pretty') {
      ui.box('DOCTOR - Documentation Health Check')
    }

    const start = performance.now()
    const config = await resolveConfig('docs', root)
    const docsDir = path.resolve(root, 'docs')
    if (!fs.existsSync(docsDir)) {
      if (reportFormat === 'pretty')
        ui.error(`Docs dir not found at ${docsDir}`)
      process.exit(1)
    }

    if (reportFormat === 'pretty') {
      ui.info(
        `${ui.colors.dim}🔍 Discovering files and routes...${ui.colors.reset}`,
      )
    }
    const isIgnored = picomatch(doctorConfig.exclude || [])
    const api = new fdir()
      .withFullPaths()
      .filter((fullPath) => {
        const matchesExt = fullPath.endsWith('.md') || fullPath.endsWith('.mdx')
        if (!matchesExt) return false

        const relPath = path.relative(docsDir, fullPath).replace(/\\/g, '/')
        const segments = relPath.split('/')
        const isPrivate = segments.some(
          (s) => s.startsWith('_') && s !== '_index.md' && s !== '_index.mdx',
        )
        return !isIgnored(relPath) && !isPrivate
      })
      .crawl(docsDir)

    const files = await api.withPromise()
    for (const f of files) {
      fileExistsCache.set(f, true)
    }
    const linkTree = await generateLinkTree(docsDir, root, config, files)

    const base = config.base || '/'
    const basePrefix =
      base === '/' ? '' : base.endsWith('/') ? base.slice(0, -1) : base
    const routeIndex = new Set(linkTree.routes)
    const routeIndexWithSlash = new Set(
      linkTree.routes.map((r: string) => (r.endsWith('/') ? r : r + '/')),
    )
    const routeIndexWithoutSlash = new Set(
      linkTree.routes.map((r: string) =>
        r.endsWith('/') ? r.slice(0, -1) : r,
      ),
    )

    const ctx: DoctorContext = {
      root,
      docsDir,
      config,
      doctorConfig,
      linkTree,
      files,
      options,
      routeIndex,
      routeIndexWithSlash,
      routeIndexWithoutSlash,
      basePrefix,
    }

    if (reportFormat === 'pretty') {
      ui.info(
        `${ui.colors.dim}🧪 Running diagnostic checks in parallel...${ui.colors.reset}`,
      )
    }

    const [metadataIssues, linkIssues, i18nIssues, sidebarIssues] =
      await Promise.all([
        checkMetadata(ctx),
        checkLinks(ctx),
        checkI18n(ctx),
        checkSidebar(ctx),
      ])

    const issues = [
      ...metadataIssues,
      ...linkIssues,
      ...i18nIssues,
      ...sidebarIssues,
    ]

    // 1. Handle Automatic Fixes
    let fixedCount = 0
    if (options.fix) {
      for (const issue of issues) {
        if (issue.fix) {
          if (ctx.doctorConfig.fix.confirmChanges) {
            const confirmed = await ui.confirm(
              `Fix issue in "${issue.file}": ${issue.message}?`,
            )
            if (!confirmed) continue
          }
          if (ctx.doctorConfig.fix.backupFiles) {
            const absolutePath = path.resolve(ctx.docsDir, issue.file)
            if (fs.existsSync(absolutePath)) {
              const backupDir = path.resolve(
                ctx.root,
                ctx.doctorConfig.fix.backupPath,
              )
              await backupFile(absolutePath, backupDir)
            }
          }
          await issue.fix()
          fixedCount++
        }
      }
    }

    const duration = ((performance.now() - start) / 1000).toFixed(2)
    const high = issues.filter((i) => i.level === 'high').length
    const warning = issues.filter((i) => i.level === 'warning').length
    const low = issues.filter((i) => i.level === 'low').length

    // 2. Reporting
    const reportData = {
      summary: {
        total: issues.length,
        high,
        warning,
        low,
        fixed: fixedCount,
        duration,
      },
      issues: issues.map((i) => ({ ...i, fix: undefined })),
    }

    if (doctorConfig.reporting.outputFile) {
      const reportPath = path.resolve(root, doctorConfig.reporting.outputFile)
      if (!fs.existsSync(path.dirname(reportPath)))
        fs.mkdirSync(path.dirname(reportPath), { recursive: true })
      fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2))
    }

    if (reportFormat === 'json') {
      console.log(JSON.stringify(reportData, null, 2))
    } else if (reportFormat === 'pretty') {
      const groupedIssues = issues.reduce(
        (acc, issue) => {
          if (!acc[issue.file]) acc[issue.file] = []
          acc[issue.file].push(issue)
          return acc
        },
        {} as Record<string, DoctorIssue[]>,
      )

      if (issues.length > 0) {
        ui.divider()
        for (const [file, fileIssues] of Object.entries(groupedIssues)) {
          console.log(`\n${colors.bold}${colors.cyan}📄 ${file}${colors.reset}`)
          for (const issue of fileIssues) {
            const icon =
              issue.level === 'high'
                ? '❌'
                : issue.level === 'warning'
                  ? '⚠️'
                  : 'ℹ️'
            const color =
              issue.level === 'high'
                ? colors.red
                : issue.level === 'warning'
                  ? colors.yellow
                  : colors.blue
            console.log(
              `   ${icon} ${color}${issue.level.toUpperCase()}${colors.reset}: ${issue.message}`,
            )
            if (issue.suggestion) {
              console.log(
                `      ${colors.dim}💡 Suggestion: ${issue.suggestion}${colors.reset}`,
              )
            }
            if (options.fix && issue.fix) {
              console.log(
                `      ${colors.green}✅ Fixed automatically${colors.reset}`,
              )
            }
          }
        }
        ui.divider()
      }

      if (issues.length === 0) {
        ui.success(
          'Everything looks perfect! Your documentation is in great shape. ✨',
        )
      } else {
        console.log(
          `\n${colors.bold}Diagnosis Results (${duration}s):${colors.reset}`,
        )
        if (high > 0)
          console.log(
            `   ${colors.red}● ${high} Critical Errors${colors.reset}`,
          )
        if (warning > 0)
          console.log(`   ${colors.yellow}● ${warning} Warnings${colors.reset}`)
        if (low > 0)
          console.log(`   ${colors.blue}● ${low} Improvements${colors.reset}`)

        if (fixedCount > 0) {
          ui.success(`Successfully fixed ${fixedCount} issues automatically!`)
        }

        if (high > 0) {
          console.log(
            `\n${colors.red}${colors.bold}[boltdocs] Please fix the critical errors before building for production.${colors.reset}`,
          )
        } else {
          ui.success(
            '[boltdocs] No critical issues found. You are ready to go!',
          )
        }
      }
    }

    if (doctorConfig.reporting.failOnError && high > 0) {
      process.exit(1)
    }
    if (
      doctorConfig.reporting.maxWarnings !== -1 &&
      warning > doctorConfig.reporting.maxWarnings
    ) {
      if (reportFormat === 'pretty')
        ui.error(
          `Failed: Too many warnings (${warning} > ${doctorConfig.reporting.maxWarnings})`,
        )
      process.exit(1)
    }
  } catch (e) {
    ui.error(`Doctor failed: ${e}`)
    process.exit(1)
  }
}
