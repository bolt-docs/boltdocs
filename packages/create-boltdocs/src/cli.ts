import prompts from 'prompts'
import { colors, colorize, warn } from '@bdocs/dui'

export interface CliOptions {
  projectName: string
  template: string
  deployTarget: string
  install: boolean
}

export interface ParsedArgs {
  projectName: string
  template: string
  deployTarget: string
  install: boolean | undefined
}

/**
 * Parses CLI arguments into typed options.
 */
export function parseArgs(args: string[]): ParsedArgs {
  let projectName = ''
  let template = ''
  let install: boolean | undefined
  let deployTarget = ''

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--template' || arg === '-t') {
      template = args[++i] || ''
    } else if (arg === '--deploy' || arg === '-d') {
      deployTarget = args[++i] || ''
    } else if (arg === '--install' || arg === '-i') {
      install = true
    } else if (arg === '--no-install') {
      install = false
    } else if (arg === '--name' || arg === '-n' || arg === '--projectName') {
      projectName = args[++i] || ''
    } else if (!arg.startsWith('-')) {
      if (!projectName) {
        projectName = arg
      }
    }
  }

  return {
    projectName,
    template,
    deployTarget,
    install,
  }
}

export async function parseCliAndPrompt(): Promise<CliOptions | null> {
  const args = process.argv.slice(2)
  const parsed = parseArgs(args)

  const argProjectName = parsed.projectName
  let argTemplate = parsed.template
  let argDeployTarget = parsed.deployTarget
  const argInstall = parsed.install

  // Validate template if passed
  if (argTemplate && argTemplate !== 'base' && argTemplate !== 'i18n') {
    warn(`Template "${argTemplate}" is invalid. Falling back to prompt.`)
    argTemplate = ''
  }

  const validDeployTargets = [
    'vercel',
    'netlify',
    'cloudflare',
    'aws',
    'static',
  ]
  if (argDeployTarget && !validDeployTargets.includes(argDeployTarget)) {
    warn(
      `Deploy target "${argDeployTarget}" is invalid. Falling back to prompt.`,
    )
    argDeployTarget = ''
  }

  const response = await prompts([
    ...(argProjectName
      ? []
      : [
          {
            type: 'text' as const,
            name: 'projectName',
            message: 'Project name:',
            initial: 'my-boltdocs-app',
          },
        ]),
    ...(argTemplate
      ? []
      : [
          {
            type: 'select' as const,
            name: 'template',
            message: 'Select a preset template:',
            choices: [
              {
                title: colors.magenta('Base'),
                description: 'Hero and custom components.',
                value: 'base',
              },
              {
                title: colors.yellow('i18n'),
                description: 'Multi-language support (EN/ES).',
                value: 'i18n',
              },
            ],
            initial: 0,
          },
        ]),
    ...(argDeployTarget
      ? []
      : [
          {
            type: 'select' as const,
            name: 'deployTarget',
            message: 'Select a deployment target (for custom feedback):',
            choices: [
              {
                title: colors.cyan('Vercel'),
                description:
                  'Zero-config deployment with serverless feedback API.',
                value: 'vercel',
              },
              {
                title: colors.green('Netlify'),
                description: 'Deploy using Netlify Functions for feedback.',
                value: 'netlify',
              },
              {
                title: colorize('Cloudflare Pages', '#f6821f'),
                description: 'Deploy using Cloudflare Pages Functions.',
                value: 'cloudflare',
              },
              {
                title: colors.red('AWS Lambda'),
                description: 'Deploy serverless API handler via AWS Lambda.',
                value: 'aws',
              },
              {
                title: colors.dim('Static Only'),
                description:
                  'Pure static SSG without feedback serverless functions.',
                value: 'static',
              },
            ],
            initial: 0,
          },
        ]),
    ...(argInstall !== undefined
      ? []
      : [
          {
            type: 'confirm' as const,
            name: 'install',
            message: 'Install dependencies?',
            initial: true,
          },
        ]),
  ])

  const projectName = argProjectName || response.projectName
  const template = argTemplate || response.template
  const deployTarget = argDeployTarget || response.deployTarget
  const install = argInstall !== undefined ? argInstall : response.install

  if (!projectName || !template || !deployTarget) {
    return null
  }

  return {
    projectName,
    template,
    deployTarget,
    install,
  }
}
