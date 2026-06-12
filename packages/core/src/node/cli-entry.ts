#!/usr/bin/env node

// Suppress DEP0205 deprecation warning for module.register() in Node 26+
const { emitWarning: _emitWarn } = process
process.emitWarning = function (warning: any, ...args: any[]) {
  if (warning && typeof warning === 'object' && warning.code === 'DEP0205') return
  if (typeof warning === 'string' && args.includes('DEP0205')) return
  return Reflect.apply(_emitWarn, process, [warning, ...args])
}

import { applyFsPatch } from './security/fs-patch'
applyFsPatch()

import { configure } from '@bdocs/dui'
import cac from 'cac'
import { devAction, buildAction, previewAction, auditAction } from './cli/index'

// Configure @bdocs/dui with boltdocs-specific values once, at process start.
// All packages that share this process (ssg, plugins, etc.) inherit this config.
configure({
  prefix: 'boltdocs',
})

const cli = cac('boltdocs')

cli
  .command('dev [root]', 'Start development server')
  .option('--port <port>', 'Port to listen on')
  .option('--host [host]', 'Host to bind to')
  .option('--force', 'Force Vite to re-optimize dependencies')
  .action(devAction)
cli
  .command('[root]', 'Start development server')
  .option('--port <port>', 'Port to listen on')
  .option('--host [host]', 'Host to bind to')
  .option('--force', 'Force Vite to re-optimize dependencies')
  .action(devAction)

cli.command('build [root]', 'Build for production').action(buildAction)

cli
  .command('preview [root]', 'Preview production build')
  .option('--port <port>', 'Port to listen on')
  .option('--host [host]', 'Host to bind to')
  .action(previewAction)

cli
  .command('audit [root]', 'Audit configured plugins for security warnings')
  .action(auditAction)

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
  .action(
    async (
      file: string,
      options: {
        output?: string
        title?: string
        inferTab?: boolean
        limit?: number
      },
    ) => {
      const { generateChangelog } = await import('./changelog/generator')
      await generateChangelog(file, {
        output: options.output,
        title: options.title,
        inferTab: options.inferTab,
        limit: options.limit ? parseInt(String(options.limit), 10) : undefined,
      })
    },
  )

cli.help()
// This will be replaced at build time or package publishing, but hardcoded to 2.0.0 for now
cli.version('2.0.0')

cli.parse()
