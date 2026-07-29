#!/usr/bin/env node

// Suppress DEP0205 deprecation warning for module.register() in Node 26+
const { emitWarning: _emitWarn } = process
process.emitWarning = (warning: any, ...args: any[]) => {
  if (warning && typeof warning === 'object' && warning.code === 'DEP0205')
    return
  if (typeof warning === 'string' && args.includes('DEP0205')) return
  return Reflect.apply(_emitWarn, process, [warning, ...args])
}

import { applyFsPatch } from './security/fs-patch'
applyFsPatch()

import { configure } from '@bdocs/dui'
import cac from 'cac'
// Command handlers are imported dynamically

configure({
  prefix: 'boltdocs',
})

const cli = cac('boltdocs')

cli
  .command('dev [root]', 'Start development server')
  .option('--port <port>', 'Port to listen on')
  .option('--host [host]', 'Host to bind to')
  .option('--force', 'Force Vite to re-optimize dependencies')
  .action(async (...args) => {
    const { devAction } = await import('./cli/dev')
    return devAction(...args)
  })
cli
  .command('[root]', 'Start development server')
  .option('--port <port>', 'Port to listen on')
  .option('--host [host]', 'Host to bind to')
  .option('--force', 'Force Vite to re-optimize dependencies')
  .action(async (...args) => {
    const { devAction } = await import('./cli/dev')
    return devAction(...args)
  })

cli.command('build [root]', 'Build for production').action(async (...args) => {
  const { buildAction } = await import('./cli/build')
  return buildAction(...args)
})

cli
  .command('preview [root]', 'Preview production build')
  .option('--port <port>', 'Port to listen on')
  .option('--host [host]', 'Host to bind to')
  .action(async (...args) => {
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

cli
  .command('theme:dev [root]', 'Preview a theme during development')
  .option('--port <port>', 'Port to listen on')
  .option('--host [host]', 'Host to bind to')
  .option('--name <name>', 'Theme display name')
  .option(
    '--layout <path>',
    'Path to a custom layout.tsx file (symlinked for HMR)',
  )
  .option(
    '--mdx <path>',
    'Path to a custom mdx-components.tsx file (symlinked for HMR)',
  )
  .option('--tailwind', 'Enable @bdocs/plugin-tailwindcss (must be installed)')
  .option(
    '--sass',
    'Enable @bdocs/plugin-sass for SASS/SCSS support (must be installed)',
  )
  .option('--verbose', 'Show full Vite logs')
  .action(async (...args) => {
    const { themeDevAction } = await import('./cli/theme')
    return themeDevAction(...args)
  })

cli.help()
cli.version('3.0.0')
cli.parse()
