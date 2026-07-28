import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
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

// In-memory cache: avoids re-loading + re-validating the config when
// resolveConfig is called multiple times with the same docsDir + root.
// The key is `${docsDir}::${root}::${command}::${mode}`.
const _configMemoryCache = new Map<string, BoltdocsConfig>()

function configCacheKey(
  docsDir: string,
  root: string,
  command: string,
  mode: string,
): string {
  return `${docsDir}::${root}::${command}::${mode}`
}

interface ConfigCacheEntry {
  filename: string
  mtimeMs: number
  size: number
  command: string
  mode: string
  config: BoltdocsConfig
}

function getConfigCachePath(root: string): string {
  return path.join(root, '.boltdocs', 'cache', 'config.json')
}

function getConfigCacheKey(
  filename: string,
  mtimeMs: number,
  size: number,
  command: string,
  mode: string,
): string {
  return crypto
    .createHash('sha256')
    .update(`${filename}:${mtimeMs}:${size}:${command}:${mode}`)
    .digest('hex')
}

function tryLoadCachedConfig(
  root: string,
  command: string,
  mode: string,
): { config: BoltdocsConfig; configFile: string } | null {
  const cachePath = getConfigCachePath(root)
  if (!fs.existsSync(cachePath)) return null

  try {
    const raw = fs.readFileSync(cachePath, 'utf-8')
    const entry = JSON.parse(raw) as ConfigCacheEntry
    const configPath = path.resolve(root, entry.filename)
    if (!fs.existsSync(configPath)) return null

    const stat = fs.statSync(configPath)
    const key = getConfigCacheKey(
      entry.filename,
      stat.mtimeMs,
      stat.size,
      command,
      mode,
    )
    const expectedKey = getConfigCacheKey(
      entry.filename,
      entry.mtimeMs,
      entry.size,
      entry.command,
      entry.mode,
    )
    if (key !== expectedKey) return null

    // Basic schema validation to avoid returning corrupt cache
    const validation = BoltdocsConfigSchema.safeParse(entry.config)
    if (!validation.success) return null

    return {
      config: validation.data as BoltdocsConfig,
      configFile: configPath,
    }
  } catch {
    return null
  }
}

function writeCachedConfig(
  root: string,
  filename: string,
  mtimeMs: number,
  size: number,
  command: string,
  mode: string,
  config: BoltdocsConfig,
): void {
  try {
    const cachePath = getConfigCachePath(root)
    fs.mkdirSync(path.dirname(cachePath), { recursive: true })
    // Strip plugin objects before serializing (functions are not JSON-safe)
    const serializableConfig = {
      ...config,
      plugins: [],
    }
    const entry: ConfigCacheEntry = {
      filename,
      mtimeMs,
      size,
      command,
      mode,
      config: serializableConfig as BoltdocsConfig,
    }
    fs.writeFileSync(cachePath, JSON.stringify(entry), 'utf-8')
  } catch (e) {
    if (process.env.BOLTDOCS_DEBUG === 'true') {
      console.warn('[boltdocs] Failed to write config cache:', e)
    }
  }
}

interface RawUserConfig
  extends Partial<BoltdocsConfig>,
    Partial<BoltdocsThemeConfig> {
  favicon?: string
  security?: BoltdocsSecurityConfig
  integrations?: BoltdocsConfig['integrations']
}

async function loadConfigWithJiti(
  configPath: string,
  projectRoot: string,
): Promise<RawUserConfig | undefined> {
  const { createJiti } = await import('jiti')
  const jiti = createJiti(projectRoot, { interopDefault: true })
  const mod = (await jiti.import(configPath)) as {
    default?: RawUserConfig
    config?: RawUserConfig
  }
  return mod.default ?? mod.config ?? (mod as RawUserConfig)
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
  command: string = 'serve',
  mode: string = 'development',
): Promise<BoltdocsConfig> {
  const projectRoot = root

  // Fast in-memory cache: if the exact same docsDir+root+command+mode was
  // already resolved in this process, return the cached result immediately
  // without any I/O or jiti transpilation. This only helps when resolveConfig
  // is called multiple times per build (e.g. once in ConfigResolveStep and
  // once in boltdocsPlugin.config()).
  const memKey = configCacheKey(docsDir, projectRoot, command, mode)
  {
    const cachedMem = _configMemoryCache.get(memKey)
    if (cachedMem) return cachedMem
  }

  // Fast warm path: if the config file hasn't changed, load the previously
  // parsed config from disk. The cached config has plugins stripped (not
  // serializable). Re-import just the plugin objects from the config file,
  // which is fast thanks to jiti's disk cache.
  const cached = tryLoadCachedConfig(projectRoot, command, mode)
  if (cached) {
    // Re-import plugins from the config file
    try {
      const userConfig = await loadConfigWithJiti(
        cached.configFile,
        projectRoot,
      )
      if (userConfig?.plugins) {
        cached.config.plugins = userConfig.plugins
      }
    } catch {
      // Plugin re-import failed; return cached config without plugins
    }
    _configMemoryCache.set(memKey, cached.config)
    return cached.config
  }

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
  let configFileUsed: {
    filename: string
    mtimeMs: number
    size: number
  } | null = null

  // Try to load user config. Prefer jiti: it transpiles TS/ESM on the fly and
  // caches the result on disk, so warm loads avoid the heavy Vite config
  // bundler. Fall back to Vite's loadConfigFromFile when jiti is unavailable.
  for (const filename of CONFIG_FILES) {
    const configPath = path.resolve(projectRoot, filename)
    if (fs.existsSync(configPath)) {
      try {
        let loadedConfig: RawUserConfig | undefined
        try {
          loadedConfig = await loadConfigWithJiti(configPath, projectRoot)
        } catch (jitiError) {
          // jiti may not handle every edge case (e.g. exotic transpiler
          // plugins). Fall back to Vite's loader so users don't break.
          if (process.env.BOLTDOCS_DEBUG === 'true') {
            console.warn(
              `[boltdocs] jiti config load failed for ${filename}, falling back to Vite: ${jitiError instanceof Error ? jitiError.message : String(jitiError)}`,
            )
          }
          const { loadConfigFromFile } = await import('vite')
          const loaded = await loadConfigFromFile(
            { command: command as 'build' | 'serve', mode },
            configPath,
            projectRoot,
          )
          loadedConfig = loaded?.config as RawUserConfig | undefined
        }
        if (loadedConfig) {
          userConfig = loadedConfig
          const stat = fs.statSync(configPath)
          configFileUsed = { filename, mtimeMs: stat.mtimeMs, size: stat.size }
          break
        }
      } catch (e) {
        if (e instanceof Error) {
          warn(`Failed to load config from ${filename}: ${e}`)
        }
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
    cleanThemeConfig.navbar = cleanThemeConfig.navbar.map((item) => ({
      label: item.label || '',
      href: item.href || '',
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

  const validatedConfig = validation.data as BoltdocsConfig

  // Persist config cache for warm builds.
  // writeCachedConfig strips plugin objects internally (plugins contain
  // non-serializable functions) so the cache is always safe to write.
  // On the next warm build, tryLoadCachedConfig reads this file and skips
  // the full config resolution (jiti transpilation + schema validation).
  if (configFileUsed) {
    writeCachedConfig(
      projectRoot,
      configFileUsed.filename,
      configFileUsed.mtimeMs,
      configFileUsed.size,
      command,
      mode,
      validatedConfig,
    )
  }

  // Populate in-memory cache so subsequent resolveConfig calls with the
  // same parameters return instantly (no I/O, no jiti, no validation).
  _configMemoryCache.set(memKey, validatedConfig)

  return validatedConfig
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
