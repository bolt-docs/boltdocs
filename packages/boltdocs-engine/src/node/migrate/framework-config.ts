import { jsonScalar } from './framework-common'

export interface ConfigPlugin {
  /** Local import name, e.g. `searchPlugin`. */
  local: string
  /** Package specifier, e.g. `@bdocs/plugin-search`. */
  specifier: string
}

export interface NavItemModel {
  label: string
  href: string
}

export interface SocialLinkModel {
  icon: string
  link: string
}

export interface LocaleModel {
  code: string
  label?: string
  htmlLang?: string
  direction?: 'ltr' | 'rtl'
}

export interface VersionModel {
  path: string
  label: string
}

export interface BoltdocsConfigModel {
  title: string
  description?: string
  favicon?: string
  base?: string
  docsDir?: string
  siteUrl?: string
  githubRepo?: string
  editLink?: string
  navbar?: NavItemModel[]
  socialLinks?: SocialLinkModel[]
  i18n?: {
    defaultLocale: string
    locales: LocaleModel[]
  }
  versions?: {
    defaultVersion: string
    prefix?: string
    versions: VersionModel[]
  }
  plugins: ConfigPlugin[]
}

/** Common locale labels so generated configs read well without a lookup table. */
const LOCALE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  it: 'Italiano',
  ja: '日本語',
  ko: '한국어',
  zh: '中文',
  ru: 'Русский',
  ar: 'العربية',
}

function localeLabel(code: string): string {
  return LOCALE_LABELS[code] ?? LOCALE_LABELS[code.split('-')[0]] ?? code
}

function requireUrl(value: string): boolean {
  return /^https?:\/\//.test(value)
}

function requireGithubLink(value: string): boolean {
  return /^https?:\/\/(?:www\.)?github\.com\//.test(value)
}

function renderNavbar(items: NavItemModel[]): string[] | null {
  const valid = items.filter((i) => i.label && i.href)
  if (valid.length === 0) return null
  const lines = ['    navbar: [']
  for (const item of valid) {
    lines.push(
      `      { label: ${jsonScalar(item.label)}, href: ${jsonScalar(item.href)} },`,
    )
  }
  lines.push('    ],')
  return lines
}

function renderSocialLinks(items: SocialLinkModel[]): string[] | null {
  const valid = items.filter((i) => i.icon && i.link && requireUrl(i.link))
  if (valid.length === 0) return null
  const lines = ['    socialLinks: [']
  for (const item of valid) {
    lines.push(
      `      { icon: ${jsonScalar(item.icon)}, link: ${jsonScalar(item.link)} },`,
    )
  }
  lines.push('    ],')
  return lines
}

function renderI18n(i18n: NonNullable<BoltdocsConfigModel['i18n']>): string[] {
  const withMeta = i18n.locales.some(
    (l) => l.label || l.htmlLang || l.direction,
  )
  const lines = [
    '  i18n: {',
    `    defaultLocale: ${jsonScalar(i18n.defaultLocale)},`,
  ]

  if (withMeta) {
    lines.push('    locales: {')
    for (const l of i18n.locales) {
      lines.push(
        `      ${jsonScalar(l.code)}: ${jsonScalar(l.label ?? localeLabel(l.code))},`,
      )
    }
    lines.push('    },')
    const detailed = i18n.locales.filter(
      (l) => l.htmlLang || l.direction || l.label,
    )
    if (detailed.length > 0) {
      lines.push('    localeConfigs: {')
      for (const l of detailed) {
        const parts: string[] = []
        if (l.label) parts.push(`label: ${jsonScalar(l.label)}`)
        if (l.direction) parts.push(`direction: ${jsonScalar(l.direction)}`)
        if (l.htmlLang) parts.push(`htmlLang: ${jsonScalar(l.htmlLang)}`)
        lines.push(`      ${jsonScalar(l.code)}: { ${parts.join(', ')} },`)
      }
      lines.push('    },')
    }
  } else {
    lines.push(
      `    locales: [${i18n.locales.map((l) => jsonScalar(l.code)).join(', ')}],`,
    )
  }
  lines.push('  },')
  return lines
}

function renderVersions(
  versions: NonNullable<BoltdocsConfigModel['versions']>,
): string[] {
  const lines = [
    '  versions: {',
    `    defaultVersion: ${jsonScalar(versions.defaultVersion)},`,
  ]
  if (versions.prefix) lines.push(`    prefix: ${jsonScalar(versions.prefix)},`)
  lines.push('    versions: [')
  for (const v of versions.versions) {
    lines.push(
      `      { label: ${jsonScalar(v.label)}, path: ${jsonScalar(v.path)} },`,
    )
  }
  lines.push('    ],')
  lines.push('  },')
  return lines
}

/**
 * Renders a starter `boltdocs.config.ts`.
 *
 * Every emitted value comes from a detected field; anything uncertain becomes
 * a `// TODO` comment rather than a guess. A generated config is therefore
 * always syntactically valid and never invents URLs or credentials.
 */
export function renderBoltdocsConfig(model: BoltdocsConfigModel): string {
  const imports = [
    "import { defineConfig } from 'boltdocs'",
    ...model.plugins.map(
      (p) => `import ${p.local} from ${jsonScalar(p.specifier)}`,
    ),
  ]

  const lines: string[] = [...imports, '', 'export default defineConfig({']

  if (model.base && model.base !== '/') {
    lines.push(`  base: ${jsonScalar(model.base)},`)
  }
  if (model.docsDir && model.docsDir !== 'docs') {
    lines.push(`  docsDir: ${jsonScalar(model.docsDir)},`)
  }

  lines.push('  theme: {')
  lines.push(`    title: ${jsonScalar(model.title)},`)
  if (model.description) {
    lines.push(`    description: ${jsonScalar(model.description)},`)
  }
  if (model.favicon) {
    lines.push(`    favicon: ${jsonScalar(model.favicon.replace(/^\//, ''))},`)
  }
  if (model.githubRepo?.includes('/')) {
    lines.push(`    githubRepo: ${jsonScalar(model.githubRepo)},`)
  }
  if (model.editLink?.includes(':path')) {
    lines.push(`    editLink: ${jsonScalar(model.editLink)},`)
  } else if (model.editLink) {
    lines.push(`    // TODO: add a ':path' placeholder to the edit URL:`)
    lines.push(`    // editLink: ${jsonScalar(model.editLink)},`)
  }
  const navbar = model.navbar ? renderNavbar(model.navbar) : null
  if (navbar) lines.push(...navbar)
  const socials = model.socialLinks?.filter((s) =>
    s.icon === 'github' ? requireGithubLink(s.link) : requireUrl(s.link),
  )
  if (socials && socials.length > 0) {
    const rendered = renderSocialLinks(socials)
    if (rendered) lines.push(...rendered)
  }
  lines.push('  },')

  if (model.i18n && model.i18n.locales.length > 0) {
    lines.push(...renderI18n(model.i18n))
  }
  if (model.versions && model.versions.versions.length > 0) {
    lines.push(...renderVersions(model.versions))
  }

  if (model.siteUrl) {
    lines.push(
      `  // TODO: configure SEO site URL in @bdocs/plugin-seo (detected: ${jsonScalar(model.siteUrl)})`,
    )
  }

  lines.push('  plugins: [')
  for (const p of model.plugins) lines.push(`    ${p.local}(),`)
  lines.push('  ],')
  lines.push('})', '')
  return lines.join('\n')
}

export const CORE_PLUGINS: ConfigPlugin[] = [
  { local: 'searchPlugin', specifier: '@bdocs/plugin-search' },
  { local: 'seoPlugin', specifier: '@bdocs/plugin-seo' },
]

export const RSS_PLUGIN: ConfigPlugin = {
  local: 'rssPlugin',
  specifier: '@bdocs/plugin-rss',
}
