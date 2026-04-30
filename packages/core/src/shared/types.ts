import type { Plugin as VitePlugin } from 'vite'

/**
 * Represents a single social link in the configuration.
 */
export interface BoltdocsSocialLink {
  icon: 'discord' | 'x' | 'github' | 'bluesky' | string
  link: string
}

/**
 * Configuration for the site footer.
 */
export interface BoltdocsFooterConfig {
  text?: string
}

/**
 * Theme-specific configuration options.
 */
export interface BoltdocsThemeConfig {
  title?: string | Record<string, string>
  description?: string | Record<string, string>
  logo?:
  | string
  | {
    dark: string
    light: string
    alt?: string
    width?: number
    height?: number
  }
  navbar?: Array<{
    label: string | Record<string, string>
    href: string
  }>
  sidebar?: Record<string, Array<{ text: string; link: string }>>
  sidebarGroups?: Record<string, { title?: string | Record<string, string>; icon?: string }>
  socialLinks?: BoltdocsSocialLink[]
  footer?: BoltdocsFooterConfig
  breadcrumbs?: boolean
  editLink?: string
  communityHelp?: string
  version?: string
  githubRepo?: string
  favicon?: string
  poweredBy?: boolean
  tabs?: Array<{
    id: string
    text: string | Record<string, string>
    icon?: string
  }>
  codeTheme?: ShikiTheme | { light: ShikiTheme; dark: ShikiTheme }
  copyMarkdown?: boolean | { text?: string; icon?: string }
}

/**
 * List of supported syntax highlighting themes.
 */
export type ShikiTheme =
  | 'github-dark'
  | 'github-light'
  | 'tokyo-night'
  | 'dracula'
  | 'nord'
  | 'one-dark-pro'
  | 'one-light'

/**
 * Configuration for the robots.txt file.
 */
export type BoltdocsRobotsConfig =
  | string
  | {
    rules?: Array<{
      userAgent: string
      allow?: string | string[]
      disallow?: string | string[]
    }>
    sitemaps?: string[]
  }

/**
 * Configuration for a specific locale.
 */
export interface BoltdocsLocaleConfig {
  label?: string
  direction?: 'ltr' | 'rtl'
  htmlLang?: string
  calendar?: string
}

/**
 * Configuration for internationalization (i18n).
 */
export interface BoltdocsI18nConfig {
  defaultLocale: string
  locales: string[] | Record<string, string>
  localeConfigs?: Record<string, BoltdocsLocaleConfig>
}

/**
 * Configuration for a specific documentation version.
 */
export interface BoltdocsVersionConfig {
  label: string
  path: string
}

/**
 * Configuration for documentation versioning.
 */
export interface BoltdocsVersionsConfig {
  defaultVersion: string
  prefix?: string
  versions: BoltdocsVersionConfig[]
}

/**
 * Defines a Boltdocs plugin.
 */
export interface BoltdocsPlugin {
  name: string
  enforce?: 'pre' | 'post'
  version?: string
  boltdocsVersion?: string
  permissions?: string[] // simplified for shared types
  remarkPlugins?: unknown[]
  rehypePlugins?: unknown[]
  vitePlugins?: VitePlugin[]
  components?: Record<string, string>
  hooks?: Record<string, any>
}

/**
 * Configuration for security-related settings.
 */
export interface BoltdocsSecurityConfig {
  headers?: Record<string, string>
  enableCSP?: boolean
  customHeaders?: Record<string, string>
}

/**
 * Configuration for SEO.
 */
export interface BoltdocsSeoConfig {
  metatags?: Record<string, string>
  indexing?: 'all' | 'public'
  thumbnails?: {
    background?: string
  }
}

/**
 * Configuration for third-party integrations.
 */
export interface BoltdocsIntegrationsConfig {
  ga4?: {
    measurementId: string
    debug?: boolean
  }
  gtm?: {
    tagId: string
  }
}

/**
 * The root configuration object for Boltdocs.
 */
export interface BoltdocsConfig {
  siteUrl?: string
  docsDir?: string
  base?: string
  homePage?: string
  theme?: BoltdocsThemeConfig
  i18n?: BoltdocsI18nConfig
  versions?: BoltdocsVersionsConfig
  plugins?: BoltdocsPlugin[]
  robots?: BoltdocsRobotsConfig
  security?: BoltdocsSecurityConfig
  seo?: BoltdocsSeoConfig
  integrations?: BoltdocsIntegrationsConfig
  vite?: any // Avoid pulling in entire Vite types here
}

/**
 * Global namespace for Boltdocs types that can be augmented by generated code.
 * This allows for strictly typed locales and versions based on the project configuration.
 */
declare global {
  namespace Boltdocs {
    interface Types {}
  }
}

export type BoltdocsTypes = Boltdocs.Types

export type BoltdocsLocale = Boltdocs.Types extends { Locale: infer L } ? L : string
export type BoltdocsVersion = Boltdocs.Types extends { Version: infer V } ? V : string

