#!/usr/bin/env node

// Suppress DEP0205 deprecation warning for module.register() in Node 26+
const { emitWarning: _emitWarn } = process
process.emitWarning = (warning: string | Error, ...args: unknown[]) => {
  const code = (warning as { code?: unknown } | null)?.code
  if (warning && typeof warning === 'object' && code === 'DEP0205') return
  if (typeof warning === 'string' && args.includes('DEP0205')) return
  return Reflect.apply(_emitWarn, process, [warning, ...args])
}

import { applyFsPatch } from './security/fs-patch'
applyFsPatch()

import cac from 'cac'
import { createRequire } from 'node:module'

// Command handlers are imported dynamically. The former theme preview command
// is intentionally not supported; keep the guard here because CAC's default
// command also accepts arbitrary positional roots.
const removedThemeCommand = ['theme', 'dev'].join(':')

// dui's configure() is deferred so that `--help` and `--version` (and any
// command that does not render UI) never pay the cost of loading the dui
// module graph. Commands that render UI call ensureDui() before logging.
let duiConfigured = false
async function ensureDui(): Promise<void> {
  if (duiConfigured) return
  const { configure } = await import('@bdocs/dui')
  configure({ prefix: 'boltdocs' })
  duiConfigured = true
}

const cli = cac('boltdocs')

cli
  .command('dev [root]', 'Start development server')
  .option('--port <port>', 'Port to listen on')
  .option('--host [host]', 'Host to bind to')
  .option('--force', 'Force Vite to re-optimize dependencies')
  .action(async (...args) => {
    await ensureDui()
    const { devAction } = await import('./cli/dev')
    return devAction(...args)
  })
cli
  .command('[root]', 'Start development server')
  .option('--port <port>', 'Port to listen on')
  .option('--host [host]', 'Host to bind to')
  .option('--force', 'Force Vite to re-optimize dependencies')
  .action(async (root: string = process.cwd(), options) => {
    if (root === removedThemeCommand) {
      throw new Error(`Unknown command: ${removedThemeCommand}`)
    }
    await ensureDui()
    const { devAction } = await import('./cli/dev')
    return devAction(root, options)
  })

cli.command('build [root]', 'Build for production').action(async (...args) => {
  await ensureDui()
  const { buildAction } = await import('./cli/build')
  return buildAction(...args)
})

cli
  .command('preview [root]', 'Preview production build')
  .option('--port <port>', 'Port to listen on')
  .option('--host [host]', 'Host to bind to')
  .action(async (...args) => {
    await ensureDui()
    const { previewAction } = await import('./cli/build')
    return previewAction(...args)
  })

cli
  .command('audit [root]', 'Audit configured plugins for security warnings')
  .action(async (...args) => {
    const { auditAction } = await import('./cli/audit')
    return auditAction(...args)
  })

cli
  .command('doctor [root]', 'Check the health of your documentation')
  .option(
    '--fix',
    'Automatically fix broken internal links and sync translations',
  )
  .option('--check-external', 'Verify external links (slower)')
  .option('--init', 'Initialize doctor.json with default configuration')
  .option('--budget', 'Check build performance against configured budgets')
  .action(
    async (
      root: string,
      options: {
        fix?: boolean
        checkExternal?: boolean
        init?: boolean
        budget?: boolean
      },
    ) => {
      await ensureDui()
      const { doctorAction } = await import('./cli/doctor')
      await doctorAction(root, options)
    },
  )

cli
  .command(
    'generate-changelog <file>',
    'Generate changelog documentation from CHANGELOG.md',
  )
  .option('-o, --output <path>', 'Output folder (default: docs/changelog)', {
    default: 'docs/changelog',
  })
  .option('-t, --title <text>', 'Title for changelog pages', {
    default: 'Changelog',
  })
  .option('--infer-tab', 'Infer tab from folder name (default: true)', {
    default: true,
  })
  .option('-l, --limit <number>', 'Limit number of versions to generate')
  .option(
    '--type <"major"|"minor"|"patch">',
    'Filter by version type (major, minor, or patch)',
  )
  .action(
    async (
      file: string,
      options: {
        output?: string
        title?: string
        inferTab?: boolean
        limit?: number
        type?: string | undefined
      },
    ) => {
      await ensureDui()
      const { generateChangelog } = await import('./changelog/generator')
      await generateChangelog(file, {
        output: options.output,
        title: options.title,
        inferTab: options.inferTab,
        limit: options.limit ? parseInt(String(options.limit), 10) : undefined,
        type: options.type as 'major' | 'minor' | 'patch' | undefined,
      })
    },
  )
// Read the real package version instead of hardcoding it — `--version`
// drifted from the published version (was stuck at 3.0.0).
const localRequire = createRequire(import.meta.url)
const pkg = localRequire('../../package.json') as { version: string }
cli.version(pkg.version)
cli.parse()
