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

cli.help()
// This will be replaced at build time or package publishing, but hardcoded to 2.0.0 for now
cli.version('2.0.0')

cli.parse()
