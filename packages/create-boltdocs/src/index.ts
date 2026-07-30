#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { colors, warn, error, steps, renderStatic } from '@bdocs/dui'
import type { StepItem } from '@bdocs/dui'

import { parseCliAndPrompt } from './cli'
import type { IconLibrary } from './cli'
import { getPackageManager } from './utils/package-manager'
import { copy, writeFile } from './utils/file-system'
import { adaptersDeploy } from './deploy/adapters'

function installDependencies(
  pkgManager: string,
  projectDir: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      pkgManager,
      [pkgManager === 'yarn' ? '' : 'install'].filter(Boolean),
      {
        cwd: projectDir,
        stdio: 'ignore',
        shell: true,
      },
    )

    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Package manager exited with code ${code}`))
      }
    })

    child.on('error', (err) => {
      reject(err)
    })
  })
}

const BANNER = colors.cyan.bold(`
   ██████╗  ██████╗ ██╗  ████████╗██████╗  ██████╗  ██████╗███████╗
   ██╔══██╗██╔═══██╗██║  ╚══██╔══╝██╔══██╗██╔═══██╗██╔════╝██╔════╝
   ██████╔╝██║   ██║██║     ██║   ██║  ██║██║   ██║██║     ███████╗
   ██╔══██╗██║   ██║██║     ██║   ██║  ██║██║   ██║██║     ╚════██║
   ██████╔╝╚██████╔╝███████╗██║   ██████╔╝╚██████╔╝╚██████╗███████║
   ╚══════╝  ╚═════╝ ╚══════╝╚═╝   ╚═════╝  ╚═════╝  ╚═════╝╚══════╝`)

const TAGLINE = colors.dim(
  '\n  ⚡ Boltdocs - the modern documentation framework\n',
)

function renderAll(stepsList: StepItem[]) {
  if (process.stdout.isTTY) {
    console.clear()
  }
  console.log(BANNER)
  console.log(TAGLINE)
  console.log(steps(stepsList))
}

const ICON_LIBRARY_VERSIONS: Record<IconLibrary, string> = {
  'lucide-react': '^0.487.0',
  '@heroicons/react': '^2.2.0',
  '@phosphor-icons/react': '^2.4.1',
}

const ICON_IMPORTS: Record<IconLibrary, string> = {
  'lucide-react': `import { Route, FileText, Settings, Sparkles, BookOpen, Rocket } from 'lucide-react'`,
  '@heroicons/react': `import {
  MapIcon as Route,
  DocumentTextIcon as FileText,
  Cog8ToothIcon as Settings,
  SparklesIcon as Sparkles,
  BookOpenIcon as BookOpen,
  RocketLaunchIcon as Rocket,
} from '@heroicons/react/24/outline'`,
  '@phosphor-icons/react': `import { Route, FileText, Settings, Sparkles, BookOpen, Rocket } from '@phosphor-icons/react'`,
}

function getIconLibraryVersion(iconLibrary: IconLibrary): string {
  return ICON_LIBRARY_VERSIONS[iconLibrary]
}

function generateIconsFile(projectDir: string, iconLibrary: IconLibrary): void {
  const importLine = ICON_IMPORTS[iconLibrary]
  const content = `${importLine}

/**
 * Custom icon registry consumed by Boltdocs via virtual:boltdocs-icons.
 * Use these names in meta.json ("icon": "Rocket") or theme config
 * (tabs, sidebarGroups, socialLinks, etc.).
 */
const icons = {
  Route,
  FileText,
  Settings,
  Sparkles,
  BookOpen,
  Rocket,
}

export { Route, FileText, Settings, Sparkles, BookOpen, Rocket }
export default icons
`
  writeFile(path.join(projectDir, 'docs', 'icons.tsx'), content)
}

function scaffoldTemplate(
  templateDir: string,
  projectDir: string,
  iconLibrary: IconLibrary,
  projectName: string,
): void {
  const iconPackageName = iconLibrary
  const iconLibraryVersion = getIconLibraryVersion(iconLibrary)

  copy(templateDir, projectDir, {
    name: projectName,
    title: projectName,
    iconLibraryPackage: iconPackageName,
    iconLibraryVersion,
  })

  generateIconsFile(projectDir, iconLibrary)
}

export async function run() {
  const pkgManager = getPackageManager()

  console.log(BANNER)
  console.log(TAGLINE)

  const options = await parseCliAndPrompt()
  if (!options) {
    warn('Operation canceled.')
    return
  }

  const { projectName, template, deployTarget, install, iconLibrary } = options
  const projectDir = path.join(process.cwd(), projectName)

  if (fs.existsSync(projectDir)) {
    error(`Directory "${projectName}" already exists.`)
    process.exit(1)
  }

  const stepsList: StepItem[] = [
    { label: 'Creating project structure', status: 'running' },
    { label: 'Configuring deployment', status: 'pending' },
  ]

  if (install) {
    stepsList.push({ label: 'Installing dependencies', status: 'pending' })
  }

  stepsList.push({ label: 'Finalizing setup', status: 'pending' })

  renderAll(stepsList)

  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const templateDir = path.resolve(__dirname, '..', 'templates', template)

  if (!fs.existsSync(templateDir)) {
    error(`Template "${template}" not found at ${templateDir}`)
    process.exit(1)
  }

  try {
    scaffoldTemplate(templateDir, projectDir, iconLibrary, projectName)

    stepsList[0].status = 'success'
    stepsList[1].status = 'running'
    renderAll(stepsList)

    adaptersDeploy(projectDir, deployTarget)

    stepsList[1].status = 'success'

    const installIndex = stepsList.findIndex(
      (s) => s.label === 'Installing dependencies',
    )
    if (installIndex !== -1) {
      stepsList[installIndex].status = 'running'
    } else {
      const finalIdx = stepsList.findIndex(
        (s) => s.label === 'Finalizing setup',
      )
      stepsList[finalIdx].status = 'running'
    }
    renderAll(stepsList)
  } catch (e) {
    stepsList[0].status = 'error'
    stepsList[0].details = e instanceof Error ? e.message : String(e)
    renderAll(stepsList)
    process.exit(1)
  }

  let installFailed = false
  if (install) {
    try {
      await installDependencies(pkgManager, projectDir)
      const step = stepsList.find((s) => s.label === 'Installing dependencies')
      if (step) step.status = 'success'
    } catch (_e) {
      const step = stepsList.find((s) => s.label === 'Installing dependencies')
      if (step) {
        step.status = 'error'
        step.details = 'Failed to install dependencies'
      }
      installFailed = true
    }

    const finalStep = stepsList.find((s) => s.label === 'Finalizing setup')
    if (finalStep) finalStep.status = 'running'
    renderAll(stepsList)
  }

  const finalStep = stepsList.find((s) => s.label === 'Finalizing setup')
  if (finalStep) finalStep.status = 'success'
  renderAll(stepsList)

  if (installFailed) {
    warn(
      `Could not install dependencies automatically. Please run "${pkgManager} install" manually inside the project directory.`,
    )
  }

  renderStatic(colors.bold('  ✨ All set! Your documentation is ready. ✨'))
  console.log('')
  console.log('  To start developing:')
  console.log(`    cd ${projectName}`)
  if (!install) console.log(`    ${pkgManager} install`)
  console.log(`    ${pkgManager} run dev`)
  console.log('')
}

run().catch((e) => error('Unhandled error', e))
