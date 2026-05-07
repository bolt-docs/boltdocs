#!/usr/bin/env node
import cac from 'cac'
import { devAction, buildAction, previewAction } from './cli/index'

const cli = cac('boltdocs')

cli.command('[root]', 'Start development server').alias('dev').action(devAction)

cli.command('build [root]', 'Build for production').action(buildAction)

cli.command('preview [root]', 'Preview production build').action(previewAction)

cli
  .command('doctor [root]', 'Check the health of your documentation')
  .option(
    '--fix',
    'Automatically fix broken internal links and sync translations',
  )
  .option('--check-external', 'Verify external links (slower)')
  .option('--init', 'Initialize doctor.json with default configuration')
  .action(
    async (
      root: string,
      options: { fix?: boolean; checkExternal?: boolean; init?: boolean },
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
