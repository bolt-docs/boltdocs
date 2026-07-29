import prompts from 'prompts'
import { colors, colorize, warn } from '@bdocs/dui'

export type Template = 'base' | 'i18n' | 'blog'
export type IconLibrary =
  | 'lucide-react'
  | '@heroicons/react'
  | '@phosphor-icons/react'

export interface CliOptions {
  projectName: string
  template: Template
  deployTarget: string
  install: boolean
  iconLibrary: IconLibrary
}

export interface ParsedArgs {
  projectName: string
  template: Template | ''
  deployTarget: string
  install: boolean | undefined
  iconLibrary: IconLibrary | ''
}

/**
 * Parses CLI arguments into typed options.
 */
export function parseArgs(args: string[]): ParsedArgs {
  let projectName = ''
  let template: Template | '' = ''
  let install: boolean | undefined
  let deployTarget = ''
  let iconLibrary: IconLibrary | '' = ''

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--template' || arg === '-t') {
      template = (args[++i] || '') as Template | ''
    } else if (arg === '--deploy' || arg === '-d') {
      deployTarget = args[++i] || ''
    } else if (arg === '--install' || arg === '-i') {
      install = true
    } else if (arg === '--no-install') {
      install = false
    } else if (arg === '--name' || arg === '-n' || arg === '--projectName') {
      projectName = args[++i] || ''
    } else if (arg === '--icon-library' || arg === '-l') {
      iconLibrary = (args[++i] || '') as IconLibrary | ''
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
    iconLibrary,
  }
}

export async function parseCliAndPrompt(): Promise<CliOptions | null> {
  const args = process.argv.slice(2)
  const parsed = parseArgs(args)

  const argProjectName = parsed.projectName
  let argTemplate = parsed.template
  let argDeployTarget = parsed.deployTarget
  const argInstall = parsed.install
  let argIconLibrary = parsed.iconLibrary

  const validIconLibraries: IconLibrary[] = [
    'lucide-react',
    '@heroicons/react',
    '@phosphor-icons/react',
  ]
  if (argIconLibrary && !validIconLibraries.includes(argIconLibrary)) {
    warn(`Icon library "${argIconLibrary}" is invalid. Falling back to prompt.`)
    argIconLibrary = ''
  }

  // Validate template if passed
  const validTemplates: Template[] = ['base', 'i18n', 'blog']
  if (argTemplate && !validTemplates.includes(argTemplate)) {
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
                description: 'Docs with a hero landing page.',
                value: 'base',
              },
              {
                title: colors.yellow('i18n'),
                description: 'Multi-language support (EN/ES).',
                value: 'i18n',
              },
              {
                title: colors.cyan('Blog'),
                description: 'Docs plus a blog collection.',
                value: 'blog',
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
    ...(argIconLibrary
      ? []
      : [
          {
            type: 'select' as const,
            name: 'iconLibrary',
            message: 'Select an icon library:',
            choices: [
              {
                title: colors.yellow('Lucide React'),
                description: 'Lightweight, consistent icon set.',
                value: 'lucide-react',
              },
              {
                title: colors.cyan('Heroicons'),
                description: 'Beautiful hand-crafted SVG icons by Tailwind.',
                value: '@heroicons/react',
              },
              {
                title: colors.magenta('Phosphor Icons'),
                description: 'Flexible icon family with multiple weights.',
                value: '@phosphor-icons/react',
              },
            ],
            initial: 0,
          },
        ]),
  ])

  const projectName = argProjectName || response.projectName
  const template = (argTemplate || response.template) as Template
  const deployTarget = argDeployTarget || response.deployTarget
  const install = argInstall !== undefined ? argInstall : response.install
  const iconLibrary = argIconLibrary || (response.iconLibrary as IconLibrary)

  if (!projectName || !template || !deployTarget || !iconLibrary) {
    return null
  }

  return {
    projectName,
    template,
    deployTarget,
    install,
    iconLibrary,
  }
}
