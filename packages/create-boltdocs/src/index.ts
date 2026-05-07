#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import prompts from 'prompts'
import picocolors from 'picocolors'

const { green, yellow, bold, cyan, magenta, blue, red, dim } = picocolors

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
    blue(
      bold(`
  ____   ___  _     _____ ____   ___   ____ ____ 
 | __ ) / _ \\| |   |_   _|  _ \\ / _ \\ / ___/ ___|
 |  _ \\| | | | |     | | | | | | | | | |   \\___ \\
 | |_) | |_| | |___  | | | |_| | |_| | |___ ___) |
 |____/ \\___/|_____| |_| |____/ \\___/ \\____|____/`),
    ),
  )
  console.log(dim(`\n  v0.0.4 - The modern documentation framework\n`))

  const response = await prompts([
    {
      type: 'text',
      name: 'projectName',
      message: 'Project name:',
      initial: 'my-boltdocs-app',
    },
    {
      type: 'select',
      name: 'template',
      message: 'Select a project preset:',
      choices: [
        {
          title: magenta('Base'),
          description: 'Hero and custom components.',
          value: 'base',
        },
        {
          title: yellow('i18n'),
          description: 'Multi-language support (EN/ES).',
          value: 'i18n',
        },
      ],
      initial: 0,
    },
    {
      type: 'confirm',
      name: 'install',
      message: `Install dependencies with ${bold(pkgManager)}?`,
      initial: true,
    },
  ])

  if (!response.projectName || !response.template) {
    console.log(yellow('\nOperation canceled.'))
    return
  }

  const projectDir = path.join(process.cwd(), response.projectName)

  if (fs.existsSync(projectDir)) {
    console.error(
      red(`\nError: Directory "${response.projectName}" already exists.`),
    )
    process.exit(1)
  }

  console.log(dim(`\nBuilding your documentation site...\n`))

  // 1. Resolve template directory
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const templateDir = path.resolve(__dirname, 'templates', response.template)

  if (!fs.existsSync(templateDir)) {
    console.error(
      red(
        `\nError: Template "${response.template}" not found at ${templateDir}`,
      ),
    )
    process.exit(1)
  }

  // 2. Copy template and replace placeholders
  try {
    copy(templateDir, projectDir, {
      name: response.projectName,
      title: response.projectName,
    })
    console.log(
      `${green('✔')} Created project structure and applied "${response.template}" preset`,
    )
  } catch (error) {
    console.error(
      red(
        `\nError copying template: ${error instanceof Error ? error.message : String(error)}`,
      ),
    )
    process.exit(1)
  }

  // 3. Install dependencies if requested
  if (response.install) {
    console.log(cyan(`\nInstalling dependencies with ${pkgManager}...\n`))
    try {
      execSync(`${pkgManager} install`, { cwd: projectDir, stdio: 'inherit' })
      console.log(`\n${green('✔')} Dependencies installed successfully`)
    } catch (e) {
      console.log(
        yellow(
          `\nCould not install dependencies automatically. Please run "${pkgManager} install".`,
        ),
      )
    }
  }

  console.log(bold(green('\n✨ All set! Your documentation is ready. ✨\n')))
  console.log(`To start developing:`)
  console.log(`  cd ${response.projectName}`)
  if (!response.install) console.log(`  ${pkgManager} install`)
  console.log(`  ${pkgManager} run dev\n`)
}

run().catch(console.error)
