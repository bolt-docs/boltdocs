import { colors, double, padCenter } from '@bdocs/dui'

export function devServer(localUrl: string, networkUrl: string | null): string {
  const netLine = networkUrl
    ? `  ${colors.green('➜')}  ${colors.green('Network:')} ${colors.cyan(networkUrl)}`
    : `  ${colors.green('➜')}  ${colors.green('Network:')} ${colors.gray('use --host to expose')}`

  const lines = [
    `  ${colors.green('➜')}  ${colors.green('Local:')}   ${colors.bgGreen.white(localUrl)}`,
    netLine,
    '',
    `  ${colors.dim('press h + enter for help')}`,
  ]

  return '\n' + double(lines, { title: 'boltdocs dev server' }) + '\n'
}

export function previewServer(
  localUrl: string,
  networkUrl: string | null,
): string {
  const netLine = networkUrl
    ? `  ${colors.green('➜')}  ${colors.green('Network:')} ${colors.cyan(networkUrl)}`
    : `  ${colors.green('➜')}  ${colors.green('Network:')} ${colors.gray('use --host to expose')}`

  const lines = [
    `  ${colors.green('➜')}  ${colors.green('Local:')}   ${colors.bgGreen.white(localUrl)}`,
    netLine,
  ]

  return '\n' + double(lines, { title: 'boltdocs preview server' }) + '\n'
}

export function updateAvailable(current: string, latest: string): string {
  const lines = [
    padCenter('🚀  Update available!', 50),
    '',
    `  ${colors.dim('Current:')} ${colors.red(current)}  ${colors.gray('→')}  ${colors.green(latest)}`,
    '',
    `  ${colors.dim('Run:')}  ${colors.bold('npm install boltdocs@latest')}`,
  ]

  return '\n' + double(lines) + '\n'
}
