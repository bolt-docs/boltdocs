import { colors, error } from '@bdocs/dui'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { build } from './build'
import { dev } from './dev'

yargs(hideBin(process.argv))
  .scriptName('vite-react-ssg')
  .usage('$0 [args]')
  .command(
    'build',
    'Build SSG',
    (args) =>
      args
        .option('script', {
          choices: ['sync', 'async', 'defer', 'async defer'] as const,
          describe: 'Rewrites script loading timing',
        })
        .option('mock', {
          type: 'boolean',
          describe: 'Mock browser globals (window, document, etc.) for SSG',
        })
        .option('config', {
          alias: 'c',
          type: 'string',
          describe: 'The vite config file to use',
        })
        .option('base', {
          alias: 'b',
          type: 'string',
          describe: 'The base path to render',
        }),
    async (args) => {
      const { config: configFile = undefined, ...ssgOptions } = args

      await build(ssgOptions, { configFile })
    },
  )
  .command(
    'dev',
    'Dev SSG',
    (args) =>
      args
        .option('script', {
          choices: ['sync', 'async', 'defer', 'async defer'] as const,
          describe: 'Rewrites script loading timing',
        })
        .option('mock', {
          type: 'boolean',
          describe: 'Mock browser globals (window, document, etc.) for SSG',
        })
        .option('config', {
          alias: 'c',
          type: 'string',
          describe: 'The vite config file to use',
        })
        .option('base', {
          alias: 'b',
          type: 'string',
          describe: 'The base path to render',
        })
        .option('host', {
          type: 'boolean',
          describe: 'The host to expose',
        }),
    async (args) => {
      const { config: configFile = undefined, host, ...ssgOptions } = args

      await dev(ssgOptions, { configFile, server: { host } })
    },
  )
  .fail((msg, err, yargs) => {
    error('An internal error occurred.')
    error(`Please report an issue, if none already exists: https://github.com/daydreamer-riri/vite-react-ssg/issues`)
    yargs.exit(1, err)
  })
  .showHelpOnFail(false)
  .help().argv

export {}
