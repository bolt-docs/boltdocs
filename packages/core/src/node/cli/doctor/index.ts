import path from 'path'
import fs from 'fs'
import { fdir } from 'fdir'
import picomatch from 'picomatch'
import { colors, double, single, round, bullet, tasks, confirm, info, success, warn, error, dividerLog } from '@bdocs/dui'
import { resolveConfig } from '../../config'
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
import { checkMetadata, checkLinks, checkI18n, checkSidebar, checkPerformance } from './checkers'

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
    const start = performance.now()
    const config = await resolveConfig('docs', root)
    const docsDir = path.resolve(root, 'docs')
    if (!fs.existsSync(docsDir)) {
      if (reportFormat === 'pretty')
        error(`Docs dir not found at ${docsDir}`)
      process.exit(1)
    }

    if (reportFormat === 'pretty') {
      console.log(double('✦ DOCTOR — Documentation Health Check', [
        `  ${colors.dim('Docs dir:')} ${docsDir}`,
        `  ${colors.dim('Reports:')} ${root}/.boltdocs/reports/`,
      ]))
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

    const performanceIssues = options.budget ? extra[0] : []

    const issues = [
      ...metadataIssues,
      ...linkIssues,
      ...i18nIssues,
      ...sidebarIssues,
      ...performanceIssues,
    ]

    if (reportFormat === 'pretty') {
      const taskItems = [
        { label: `Metadata checks ${metadataIssues.length > 0 ? `— ${metadataIssues.length} issue${metadataIssues.length !== 1 ? 's' : ''}` : '— OK'}`, done: metadataIssues.length === 0 },
        { label: `Link checks ${linkIssues.length > 0 ? `— ${linkIssues.length} issue${linkIssues.length !== 1 ? 's' : ''}` : '— OK'}`, done: linkIssues.length === 0 },
        { label: `i18n checks ${i18nIssues.length > 0 ? `— ${i18nIssues.length} issue${i18nIssues.length !== 1 ? 's' : ''}` : '— OK'}`, done: i18nIssues.length === 0 },
        { label: `Sidebar checks ${sidebarIssues.length > 0 ? `— ${sidebarIssues.length} issue${sidebarIssues.length !== 1 ? 's' : ''}` : '— OK'}`, done: sidebarIssues.length === 0 },
      ]
      if (options.budget) {
        taskItems.push({
          label: `Performance budget ${performanceIssues.length > 0 ? `— ${performanceIssues.length} issue${performanceIssues.length !== 1 ? 's' : ''}` : '— OK'}`,
          done: performanceIssues.length === 0,
        })
      }
      console.log(`\n${tasks(taskItems)}`)
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
      const groupedIssues = issues.reduce(
        (acc, issue) => {
          if (!acc[issue.file]) acc[issue.file] = []
          acc[issue.file].push(issue)
          return acc
        },
        {} as Record<string, DoctorIssue[]>,
      )

      if (issues.length > 0) {
        dividerLog()
        for (const [file, fileIssues] of Object.entries(groupedIssues)) {
          const issueLines: string[] = []
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
            issueLines.push(
              `${icon} ${color(issue.level.toUpperCase())}: ${issue.message}`,
            )
            if (issue.suggestion) {
              issueLines.push(
                `   ${colors.dim(`💡 ${issue.suggestion}`)}`,
              )
            }
            if (options.fix && issue.fix) {
              issueLines.push(
                `   ${colors.green('✅ Fixed automatically')}`,
              )
            }
          }
          console.log(`\n${single(`📄 ${file}`, issueLines)}`)
        }
        dividerLog()
      }

      if (issues.length === 0) {
        console.log(round('✨ Documentation Health Check', [
          '  Everything looks perfect!',
          '  Your documentation is in great shape.',
          '',
          `  ${colors.dim(`Scanned ${files.length} file${files.length !== 1 ? 's' : ''} in ${duration}s`)}`,
        ]))
      } else {
        const summaryBullets: string[] = []
        if (high > 0) summaryBullets.push(colors.red(`${high} Critical Error${high !== 1 ? 's' : ''}`))
        if (warning > 0) summaryBullets.push(colors.yellow(`${warning} Warning${warning !== 1 ? 's' : ''}`))
        if (low > 0) summaryBullets.push(colors.blue(`${low} Improvement${low !== 1 ? 's' : ''}`))

        const summaryLines: string[] = [
          ...bullet(summaryBullets).split('\n').map(l => l.trimStart()),
          '',
          colors.dim(`Scanned ${files.length} file${files.length !== 1 ? 's' : ''} in ${duration}s`),
        ]

        console.log(`\n${double('Diagnosis Results', summaryLines)}\n`)

        if (fixedCount > 0) {
          success(`Successfully fixed ${fixedCount} issues automatically!`)
        }

        if (high > 0) {
          error('Please fix the critical errors before building for production.')
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
