#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import prompts from 'prompts'
import { colors, info, warn, error, success } from '@bdocs/dui'

function getPackageManager() {
  const userAgent = process.env.npm_config_user_agent
  if (userAgent?.includes('pnpm')) return 'pnpm'
  if (userAgent?.includes('yarn')) return 'yarn'
  if (userAgent?.includes('bun')) return 'bun'
  return 'npm'
}

/**
 * Recursively copies a directory and replaces placeholders in text files.
 */
function copy(src: string, dest: string, replacements: Record<string, string>) {
  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    for (const file of fs.readdirSync(src)) {
      copy(path.resolve(src, file), path.resolve(dest, file), replacements)
    }
  } else {
    // Only replace placeholders in text files
    const isTextFile = !/\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|gz)$/i.test(src)
    if (isTextFile) {
      let content = fs.readFileSync(src, 'utf-8')
      for (const [key, value] of Object.entries(replacements)) {
        content = content.replace(new RegExp(`{{${key}}}`, 'g'), value)
      }
      fs.writeFileSync(dest, content)
    } else {
      fs.copyFileSync(src, dest)
    }
  }
}

async function run() {
  const pkgManager = getPackageManager()

  console.log(
    colors.blue(
      colors.bold(`
  ____   ___  _     _____ ____   ___   ____ ____ 
  | __ ) / _ \\| |   |_   _|  _ \\ / _ \\ / ___/ ___|
  |  _ \\| | | | |     | | | | | | | | | |   \\___ \\
  | |_) | |_| | |___  | | | |_| | |_| | |___ ___) |
  |____/ \\___/|_____| |_| |____/ \\___/ \\____|____/`),
    ),
  )
  console.log(colors.dim(`\n  v0.0.4 - The modern documentation framework\n`))

  let argProjectName = ''
  let argTemplate = ''
  let argInstall: boolean | undefined = undefined

  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '--template' || arg === '-t') {
      argTemplate = args[++i]
    } else if (arg === '--install' || arg === '-i') {
      argInstall = true
    } else if (arg === '--no-install') {
      argInstall = false
    } else if (!arg.startsWith('-')) {
      if (!argProjectName) {
        argProjectName = arg
      }
    }
  }

  // Validate template if passed
  if (argTemplate && argTemplate !== 'base' && argTemplate !== 'i18n') {
    warn(`Template "${argTemplate}" is invalid. Falling back to prompt.`)
    argTemplate = ''
  }

  const response = await prompts([
    ...(argProjectName ? [] : [{
      type: 'text' as const,
      name: 'projectName',
      message: 'Project name:',
      initial: 'my-boltdocs-app',
    }]),
    ...(argTemplate ? [] : [{
      type: 'select' as const,
      name: 'template',
      message: 'Select a project preset:',
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
    }]),
    ...(argInstall !== undefined ? [] : [{
      type: 'confirm' as const,
      name: 'install',
      message: `Install dependencies with ${colors.bold(pkgManager)}?`,
      initial: true,
    }]),
  ])

  const projectName = argProjectName || response.projectName
  const template = argTemplate || response.template
  const install = argInstall !== undefined ? argInstall : response.install

  if (!projectName || !template) {
    warn('Operation canceled.')
    return
  }

  const projectDir = path.join(process.cwd(), projectName)

  if (fs.existsSync(projectDir)) {
    error(`Directory "${projectName}" already exists.`)
    process.exit(1)
  }

  info('Building your documentation site...')

  // 1. Resolve template directory
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const templateDir = path.resolve(__dirname, 'templates', template)

  if (!fs.existsSync(templateDir)) {
    error(`Template "${template}" not found at ${templateDir}`)
    process.exit(1)
  }

  // 2. Copy template and replace placeholders
  try {
    copy(templateDir, projectDir, {
      name: projectName,
      title: projectName,
    })
    success(
      `Created project structure and applied "${template}" preset`,
    )
  } catch (e) {
    error(
      `Error copying template: ${e instanceof Error ? e.message : String(e)}`,
    )
    process.exit(1)
  }

  // 3. Install dependencies if requested
  if (install) {
    info(`Installing dependencies with ${pkgManager}...`)
    try {
      execSync(`${pkgManager} install`, { cwd: projectDir, stdio: 'inherit' })
      success('Dependencies installed successfully')
    } catch (e) {
      warn(
        `Could not install dependencies automatically. Please run "${pkgManager} install".`,
      )
    }
  }

  success('✨ All set! Your documentation is ready. ✨')
  console.log(`To start developing:`)
  console.log(`  cd ${projectName}`)
  if (!install) console.log(`  ${pkgManager} install`)
  console.log(`  ${pkgManager} run dev\n`)
}

run().catch((e) => error('Unhandled error', e))
