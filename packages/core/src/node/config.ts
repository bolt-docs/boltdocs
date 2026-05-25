import path from 'node:path'
import fs from 'node:fs'
import { loadConfigFromFile } from 'vite'
import { BoltdocsConfigSchema } from './schema/config'
import { ValidationError } from './errors'
import { generateProjectTypes } from './types-generator'
import { warn } from '@bdocs/dui'
import type {
  BoltdocsConfig,
  BoltdocsThemeConfig,
  BoltdocsI18nConfig,
  BoltdocsVersionsConfig,
  BoltdocsPlugin,
  BoltdocsSecurityConfig,
  BoltdocsSocialLink,
  BoltdocsFooterConfig,
  BoltdocsRobotsConfig,
  BoltdocsLocaleConfig,
  BoltdocsVersionConfig,
} from '../shared/types'

export type {
  BoltdocsConfig,
  BoltdocsThemeConfig,
  BoltdocsI18nConfig,
  BoltdocsVersionsConfig,
  BoltdocsPlugin,
  BoltdocsSecurityConfig,
  BoltdocsSocialLink,
  BoltdocsFooterConfig,
  BoltdocsRobotsConfig,
  BoltdocsLocaleConfig,
  BoltdocsVersionConfig,
}

export { defineConfig } from '../shared/config-utils'

export const CONFIG_FILES = [
  'boltdocs.config.js',
  'boltdocs.config.mjs',
  'boltdocs.config.ts',
]

/**
 * Small helper to handle partial config objects from user input.
 */
interface RawUserConfig
  extends Partial<BoltdocsConfig>,
    Partial<BoltdocsThemeConfig> {
  favicon?: string
  security?: BoltdocsSecurityConfig
  integrations?: BoltdocsConfig['integrations']
}

/**
 * Loads user's configuration file (e.g., `boltdocs.config.js` or `boltdocs.config.ts`) if it exists,
 * merges it with the default configuration, and returns the final `BoltdocsConfig`.
 *
 * @param docsDir - The directory containing the documentation files
 * @param root - The project root directory (defaults to process.cwd())
 * @returns The merged configuration object
 */
export async function resolveConfig(
  docsDir: string,
  root: string = process.cwd(),
): Promise<BoltdocsConfig> {
  const projectRoot = root

  const defaults: BoltdocsConfig = {
    docsDir: path.resolve(docsDir),
    theme: {
      title: 'Boltdocs',
      description: 'A Vite documentation framework',
      navbar: [
        { label: 'Home', href: '/' },
        { label: 'Documentation', href: '/docs' },
      ],
      codeTheme: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  }

  let userConfig: RawUserConfig = {}

  // Try to load user config
  for (const filename of CONFIG_FILES) {
    const configPath = path.resolve(projectRoot, filename)
    if (fs.existsSync(configPath)) {
      try {
        const loaded = await loadConfigFromFile(
          { command: 'serve', mode: 'development' },
          configPath,
          projectRoot,
        )
        if (loaded) {
          userConfig = loaded.config as RawUserConfig
          break
        }
      } catch (e) {
        warn(`Failed to load config from ${filename}:`, e)
      }
    }
  }

  const themeConfigFromTop: BoltdocsThemeConfig = {
    title: userConfig.title,
    description: userConfig.description,
    logo: userConfig.logo,
    favicon: userConfig.favicon,
    navbar: userConfig.navbar,
    sidebar: userConfig.sidebar,
    sidebarGroups: userConfig.theme?.sidebarGroups,
    socialLinks: userConfig.socialLinks,
    githubRepo: userConfig.githubRepo,
    tabs: userConfig.tabs,
    codeTheme: userConfig.codeTheme,
    communityHelp: userConfig.communityHelp,
    version: userConfig.version,
    editLink: userConfig.editLink,
  }

  const userThemeConfig: BoltdocsThemeConfig = {
    ...themeConfigFromTop,
    ...(userConfig.theme || {}),
  }

  const cleanThemeConfig = Object.fromEntries(
    Object.entries(userThemeConfig).filter(([_, v]) => v !== undefined),
  ) as BoltdocsThemeConfig
  if (cleanThemeConfig.navbar) {
    cleanThemeConfig.navbar = cleanThemeConfig.navbar.map((item: any) => ({
      label: item.label || item.text || '',
      href: item.href || item.link || item.to || '',
      items: item.items,
    }))
  }

  const finalConfig: BoltdocsConfig = {
    docsDir: path.resolve(docsDir),
    theme: {
      ...defaults.theme,
      ...cleanThemeConfig,
    },
    i18n: userConfig.i18n
      ? {
          ...userConfig.i18n,
          locales: Array.isArray(userConfig.i18n.locales)
            ? Object.fromEntries(userConfig.i18n.locales.map((l) => [l, l]))
            : userConfig.i18n.locales,
        }
      : undefined,
    versions: userConfig.versions,
    siteUrl: userConfig.siteUrl,
    base: userConfig.base,
    seo: userConfig.seo,
    plugins: userConfig.plugins || [],
    robots: userConfig.robots,
    security: userConfig.security,
    integrations: userConfig.integrations,
    vite: userConfig.vite,
  }

  // Validate the final configuration
  const validation = BoltdocsConfigSchema.safeParse(finalConfig)
  if (!validation.success) {
    const errorMessages = validation.error.issues
      .map((err: any) => {
        const path = err.path.join('.')
        return `  - ${path}: ${err.message}`
      })
      .join('\n')

    throw new ValidationError(
      `Invalid Boltdocs configuration:\n${errorMessages}`,
    )
  }

  return validation.data as BoltdocsConfig
}

/**
 * Resolves the configuration and generates project-specific types.
 */
export async function resolveConfigAndGenerateTypes(
  docsDir: string,
  root: string = process.cwd(),
): Promise<BoltdocsConfig> {
  const config = await resolveConfig(docsDir, root)
  generateProjectTypes(config, docsDir, root)
  return config
}
