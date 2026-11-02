import path from 'node:path'
import fs from 'node:fs'
import { fdir } from 'fdir'
import picomatch from 'picomatch'
import {
  colors,
  badge,
  section,
  tasks,
  confirm,
  info,
  success,
  warn,
  error,
  colorize,
} from '@bdocs/dui'
import { resolveConfig } from '../../config'
import { notifyUpdateAvailable } from '../../update-check'
import {
  gradientWordmark,
  brandBadge,
  BOLTDOCS_VERSION,
  BRAND,
} from '../../ui-utils'
import {
  type DoctorContext,
  type DoctorIssue,
  DEFAULT_DOCTOR_CONFIG,
} from './types'
import {
  generateLinkTree,
  loadDoctorConfig,
  backupFile,
  fileExistsCache,
} from './utils'
import {
  checkMetadata,
  checkLinks,
  checkI18n,
  checkSidebar,
  checkPerformance,
} from './checkers'

export * from './types'
export { generateLinkTree, loadDoctorConfig }
export { checkMetadata, checkLinks, checkI18n, checkSidebar, checkPerformance }

/**
 * Initialize doctor.json with default configuration.
 */
export async function doctorInit(root: string) {
  const configPath = path.resolve(root, 'doctor.json')
  if (fs.existsSync(configPath)) {
    warn(`"doctor.json" already exists at ${root}.`)
    return
  }

  try {
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_DOCTOR_CONFIG, null, 2))
    success(`Created "doctor.json" with default configuration.`)
  } catch (e) {
    error(`Failed to create "doctor.json": ${e}`)
  }
}

/**
 * Main doctor entry point.
 */
export async function doctorAction(
  root: string = process.cwd(),
  options: {
    fix?: boolean
    checkExternal?: boolean
    init?: boolean
    budget?: boolean
  } = {},
) {
  if (options.init) {
    await doctorInit(root)
    return
  }

  notifyUpdateAvailable()

  try {
    const doctorConfig = await loadDoctorConfig(root)
    const { format: reportFormat } = doctorConfig.reporting
    const start = performance.now()
    const config = await resolveConfig('docs', root)
    const docsDir = path.resolve(root, 'docs')
    if (!fs.existsSync(docsDir)) {
      if (reportFormat === 'pretty') error(`Docs dir not found at ${docsDir}`)
      process.exit(1)
    }

    if (reportFormat === 'pretty') {
      const versionBadge = BOLTDOCS_VERSION
        ? ` ${brandBadge(`v${BOLTDOCS_VERSION}`)}`
        : ''
      console.log(
        `\n  ${colors.bold('⚡')} ${gradientWordmark('boltdocs')}${versionBadge} ${colors.dim('—')} ${colors.bold('doctor')} ${colors.dim('· documentation health check')}\n`,
      )
      console.log(
        `  ${colors.dim(`Docs dir  ${docsDir}`)}\n` +
          `  ${colors.dim(`Reports   ${root}/.boltdocs/reports/`)}\n`,
      )
    }

    if (reportFormat === 'pretty') {
      info(colors.dim('🔍 Discovering files and routes...'))
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

    if (reportFormat === 'pretty') {
      info(colors.dim('🧪 Running diagnostic checks in parallel...'))
    }

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
      info(colors.dim('🧪 Running diagnostic checks in parallel...'))
    }

    const checkers: Promise<DoctorIssue[]>[] = [
      checkMetadata(ctx),
      checkLinks(ctx),
      checkI18n(ctx),
      checkSidebar(ctx),
    ]

    if (options.budget) {
      checkers.push(checkPerformance(ctx))
    }

    const [metadataIssues, linkIssues, i18nIssues, sidebarIssues, ...extra] =
      await Promise.all(checkers)

    const performanceIssues: DoctorIssue[] = options.budget
      ? (extra[0] ?? [])
      : []

    const issues = [
      ...metadataIssues,
      ...linkIssues,
      ...i18nIssues,
      ...sidebarIssues,
      ...performanceIssues,
    ]

    if (reportFormat === 'pretty') {
      const countLabel = (count: number) =>
        count > 0
          ? colors.red(`${count} issue${count !== 1 ? 's' : ''}`)
          : colors.green('OK')
      const taskItems = [
        {
          label: `Metadata checks   ${countLabel(metadataIssues.length)}`,
          done: metadataIssues.length === 0,
        },
        {
          label: `Link checks       ${countLabel(linkIssues.length)}`,
          done: linkIssues.length === 0,
        },
        {
          label: `i18n checks       ${countLabel(i18nIssues.length)}`,
          done: i18nIssues.length === 0,
        },
        {
          label: `Sidebar checks    ${countLabel(sidebarIssues.length)}`,
          done: sidebarIssues.length === 0,
        },
      ]
      if (options.budget) {
        taskItems.push({
          label: `Performance budget ${countLabel(performanceIssues.length)}`,
          done: performanceIssues.length === 0,
        })
      }
      console.log(`\n${tasks(taskItems)}\n`)
    }

    // 1. Handle Automatic Fixes
    let fixedCount = 0
    if (options.fix) {
      for (const issue of issues) {
        if (issue.fix) {
          if (ctx.doctorConfig.fix.confirmChanges) {
            const confirmed = await confirm(
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
      const groupedIssues: Record<string, DoctorIssue[]> = issues.reduce(
        (acc, issue) => {
          if (!acc[issue.file]) acc[issue.file] = []
          acc[issue.file].push(issue)
          return acc
        },
        {} as Record<string, DoctorIssue[]>,
      )

      if (issues.length > 0) {
        console.log(section({ title: 'Issues', colors: { title: BRAND } }))
        for (const [file, fileIssues] of Object.entries(groupedIssues)) {
          const maxLevel: 'high' | 'warning' | 'low' = fileIssues.some(
            (i) => i.level === 'high',
          )
            ? 'high'
            : fileIssues.some((i) => i.level === 'warning')
              ? 'warning'
              : 'low'
          const badgeLabel = maxLevel.toUpperCase()
          const badgeChip =
            maxLevel === 'high'
              ? badge({ label: badgeLabel, status: 'error' })
              : maxLevel === 'warning'
                ? badge({ label: badgeLabel, status: 'warning' })
                : badge({
                    label: badgeLabel,
                    colors: { text: '#ffffff', bg: BRAND },
                  })
          console.log(`\n  ${badgeChip}  ${colors.bold(file)}`)
          for (const issue of fileIssues) {
            const icon =
              issue.level === 'high'
                ? '✖'
                : issue.level === 'warning'
                  ? '⚠'
                  : 'ℹ'
            const color =
              issue.level === 'high'
                ? colors.red
                : issue.level === 'warning'
                  ? colors.yellow
                  : (s: string) => colorize(s, BRAND, 'fg')
            console.log(`      ${color(icon)} ${issue.message}`)
            if (issue.suggestion) {
              console.log(`        ${colors.dim(`💡 ${issue.suggestion}`)}`)
            }
            if (options.fix && issue.fix) {
              console.log(`        ${colors.green('✅ Fixed automatically')}`)
            }
          }
        }
        console.log('')
      }

      if (issues.length === 0) {
        console.log(
          `  ${colors.green.bold('✨ Everything looks perfect!')} ${colors.dim('— your documentation is in great shape.')}`,
        )
        console.log(
          `  ${colors.dim(`Scanned ${files.length} file${files.length !== 1 ? 's' : ''} in ${duration}s`)}`,
        )
      } else {
        console.log(
          `\n${section({ title: 'Summary', colors: { title: BRAND } })}`,
        )
        if (high > 0)
          console.log(
            `  ${badge({ label: String(high), status: 'error' })}  ${colors.bold('high')}`,
          )
        if (warning > 0)
          console.log(
            `  ${badge({ label: String(warning), status: 'warning' })}  ${colors.bold('warning')}${warning !== 1 ? 's' : ''}`,
          )
        if (low > 0)
          console.log(
            `  ${badge({ label: String(low), colors: { text: '#ffffff', bg: BRAND } })}  ${colors.bold('low')}`,
          )
        console.log(
          `  ${colors.dim(`Scanned ${files.length} file${files.length !== 1 ? 's' : ''} in ${duration}s`)}`,
        )

        if (fixedCount > 0) {
          success(`Successfully fixed ${fixedCount} issues automatically!`)
        }

        if (high > 0) {
          error(
            'Please fix the critical errors before building for production.',
          )
        } else {
          success('No critical issues found. You are ready to go!')
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
        error(
          `Failed: Too many warnings (${warning} > ${doctorConfig.reporting.maxWarnings})`,
        )
      process.exit(1)
    }
  } catch (e) {
    error(`Doctor failed: ${e}`)
    process.exit(1)
  }
}
