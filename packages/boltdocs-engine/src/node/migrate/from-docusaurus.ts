import fs from 'node:fs'
import path from 'node:path'
import type { MigrationFinding, MigrationPlan } from './types'
import {
  arrayLiteralAfter,
  collectStringConstants,
  copyAndTransformMarkdown,
  copyPath,
  exists,
  findConfigFile,
  findUnresolvedConfigValues,
  finding,
  hasFrontmatterField,
  type UnresolvedConfigValue,
  objectAfterLiteral,
  objectLiteralAfter,
  parseFrontmatter,
  pickField,
  planPackageJson,
  readJson,
  readJsonRecord,
  readText,
  replaceFrontmatterField,
  serializeFrontmatter,
  stringPairs,
  walkDirs,
  walkFiles,
  writeText,
} from './framework-common'
import {
  convertDocusaurusAdmonitions,
  hasDocusaurusComponents,
} from './framework-content'
import { migrateSidebars } from './framework-sidebars'
import { migrateLinks } from './framework-links'
import { DOCUSAURUS_CONFIG_FILES } from './detect'
import {
  CORE_PLUGINS,
  RSS_PLUGIN,
  renderBoltdocsConfig,
  type LocaleModel,
  type NavItemModel,
  type SocialLinkModel,
  type VersionModel,
} from './framework-config'

interface DocusaurusInfo {
  title?: string
  description?: string
  siteUrl?: string
  base?: string
  favicon?: string
  githubRepo?: string
  editUrl?: string
  navbar: NavItemModel[]
  socialLinks: SocialLinkModel[]
  locales: LocaleModel[]
  defaultLocale: string
  versionPaths: string[]
  /** Docs source directory, relative to the project root (default `docs`). */
  docsDir: string
  unresolved: UnresolvedConfigValue[]
  hasI18n: boolean
  hasVersioning: boolean
  hasBlog: boolean
  hasDocs: boolean
  configFile: string | null
}

function listDirs(dir: string): string[] {
  if (!exists(dir)) return []
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
}

function extractNavbar(source: string): NavItemModel[] {
  const navbar = objectLiteralAfter(source, 'navbar')
  if (!navbar) return []
  // Docusaurus items are objects in an `items: [ ... ]` array. Scan the
  // array literal in small object chunks so label/to pairs stay together.
  const items = arrayLiteralAfter(navbar, 'items') ?? navbar
  const out: NavItemModel[] = []
  const objectRe = /\{[^{}]*\}/g
  for (const match of items.matchAll(objectRe)) {
    const pairs = stringPairs(match[0])
    const label = pairs.find(([k]) => k === 'label')?.[1]
    const href =
      pairs.find(([k]) => k === 'to')?.[1] ??
      pairs.find(([k]) => k === 'href')?.[1]
    if (label && href && !href.startsWith('http')) {
      out.push({ label, href: href.startsWith('/') ? href : `/${href}` })
    }
  }
  return out
}

/** Resolve the docs source directory from plugin/preset options. */
function detectDocsDir(source: string): string {
  const constants = collectStringConstants(source)
  const plugin = objectAfterLiteral(source, '@docusaurus/plugin-content-docs')
  const preset = objectAfterLiteral(source, 'classic')
  const presetDocs = preset ? objectLiteralAfter(preset, 'docs') : null
  const picked =
    (plugin ? pickField(plugin, 'path', constants) : undefined) ??
    (presetDocs ? pickField(presetDocs, 'path', constants) : undefined) ??
    (preset ? pickField(preset, 'path', constants) : undefined)
  if (!picked || picked === '/') return 'docs'
  return picked.replace(/^\.\//, '').replace(/\/$/, '')
}

function extractInfo(root: string, configSource: string): DocusaurusInfo {
  const configFile = findConfigFile(root, DOCUSAURUS_CONFIG_FILES)
  const docsDir = detectDocsDir(configSource)
  const title = pickField(configSource, 'title')
  const description = pickField(configSource, 'tagline')
  const siteUrl = pickField(configSource, 'url')
  const base = pickField(configSource, 'baseUrl')
  const favicon = pickField(configSource, 'favicon')
  const organizationName = pickField(configSource, 'organizationName')
  const projectName = pickField(configSource, 'projectName')
  const githubRepo =
    organizationName && projectName
      ? `${organizationName}/${projectName}`
      : undefined
  const editUrl = pickField(configSource, 'editUrl')
  const navbar = extractNavbar(configSource)

  const i18nLiteral = objectLiteralAfter(configSource, 'i18n')
  const i18nPairs = stringPairs(i18nLiteral)
  const configLocales =
    arrayLiteralAfter(configSource, 'locales') ??
    (i18nLiteral
      ? (/locales\s*:\s*\[([^\]]*)\]/.exec(i18nLiteral)?.[0] ?? null)
      : null)
  const localeCodes = configLocales
    ? [...configLocales.matchAll(/['"`]([\w-]{2,10})['"`]/g)].map((m) => m[1])
    : []
  const i18nDirs = listDirs(path.join(root, 'i18n')).filter(
    (d) => !d.startsWith('.'),
  )
  const defaultLocale =
    i18nPairs.find(([k]) => k === 'defaultLocale')?.[1] ?? 'en'
  const localeSet = [...new Set([...localeCodes, ...i18nDirs])]
  const locales: LocaleModel[] = localeSet.map((code) => ({
    code,
    label: code === 'en' ? 'English' : undefined,
  }))

  const versionDirs = listDirs(path.join(root, 'versioned_docs'))
    .map((d) => d.replace(/^version-/, ''))
    .filter(Boolean)
  const versionsJson = readJson(path.join(root, 'versions.json'))
  const versionFromJson = Array.isArray(versionsJson)
    ? versionsJson.filter((v): v is string => typeof v === 'string')
    : []
  const versionPaths = [...new Set([...versionDirs, ...versionFromJson])]

  const socialLinks: SocialLinkModel[] = githubRepo
    ? [
        {
          icon: 'github',
          link: `https://github.com/${githubRepo}`,
        },
      ]
    : []

  return {
    title,
    description,
    siteUrl,
    base,
    favicon,
    githubRepo,
    editUrl,
    navbar,
    socialLinks,
    locales,
    defaultLocale,
    versionPaths,
    docsDir,
    unresolved: findUnresolvedConfigValues(configSource, [
      'title',
      'tagline',
      'url',
      'baseUrl',
      'favicon',
      'organizationName',
      'projectName',
      'editUrl',
    ]),
    hasI18n: /\bi18n\s*:/.test(configSource) || exists(path.join(root, 'i18n')),
    hasVersioning:
      /(?:docs|versions?)\s*:/.test(configSource) ||
      exists(path.join(root, 'versioned_docs')) ||
      exists(path.join(root, 'versions.json')),
    hasBlog: exists(path.join(root, 'blog')),
    hasDocs: exists(path.join(root, docsDir)),
    configFile,
  }
}

function transformDocusaurusFrontmatter(raw: string): {
  raw: string
  notes: string[]
} {
  const notes: string[] = []
  let fm = raw

  if (hasFrontmatterField(fm, 'sidebar_position')) {
    fm = replaceFrontmatterField(fm, 'sidebar_position', 'sidebarPosition')
  }
  if (hasFrontmatterField(fm, 'sidebar_label')) {
    fm = replaceFrontmatterField(fm, 'sidebar_label', 'sidebarLabel')
  }
  if (hasFrontmatterField(fm, 'sidebar_class_name')) {
    notes.push(
      '`sidebar_class_name` is not auto-mapped; customize sidebar styling in Boltdocs theme if needed.',
    )
  }
  if (hasFrontmatterField(fm, 'hide_table_of_contents')) {
    notes.push(
      '`hide_table_of_contents` is not auto-mapped; review page layout options.',
    )
  }
  if (hasFrontmatterField(fm, 'hide_title')) {
    notes.push('`hide_title` is not auto-mapped.')
  }
  if (
    hasFrontmatterField(fm, 'pagination_next') ||
    hasFrontmatterField(fm, 'pagination_prev')
  ) {
    notes.push(
      'Custom pagination (`pagination_next`/`pagination_prev`) may need manual mapping.',
    )
  }
  if (hasFrontmatterField(fm, 'id') || hasFrontmatterField(fm, 'slug')) {
    notes.push(
      '`id`/`slug` frontmatter may need manual route/path adjustment in Boltdocs.',
    )
  }
  if (
    hasFrontmatterField(fm, 'toc_min_heading_level') ||
    hasFrontmatterField(fm, 'toc_max_heading_level')
  ) {
    notes.push('TOC heading level frontmatter may need manual configuration.')
  }

  fm = transformBlogFrontmatter(fm, notes)
  return { raw: fm, notes }
}

/**
 * Map Docusaurus blog-specific frontmatter to Boltdocs fields.
 *
 * An inline author object maps cleanly (`image_url` → `avatar`). Arrays of
 * author ids and `<!--truncate-->` have no 1:1 equivalent and are reported.
 */
function transformBlogFrontmatter(fm: string, notes: string[]): string {
  if (
    hasFrontmatterField(fm, 'authors') &&
    !hasFrontmatterField(fm, 'author')
  ) {
    const lines = fm.split(/\r?\n/)
    const index = lines.findIndex((line) => /^[ \t]*authors[ \t]*:/.test(line))
    const inline =
      lines[index]?.replace(/^[ \t]*authors[ \t]*:[ \t]*/, '').trim() ?? ''
    const nested = lines
      .slice(index + 1)
      .filter((line) => /^[ \t]+/.test(line) && line.trim() !== '')
    const value =
      nested.length > 0 ? nested.map((l) => l.trim()).join(' ') : inline
    const scalar = (key: string): string | undefined => {
      const m = value.match(new RegExp(`${key}\\s*:\\s*['"\`]([^'"\`]+)['"\`]`))
      return m?.[1]
    }

    if (/^\[/.test(value) || /(?:^|\s)-\s/.test(value)) {
      notes.push(
        '`authors` is a list or a set of author ids; map it to Boltdocs `author` (a single name/object) manually.',
      )
    } else if (/^\{/.test(value)) {
      const name = scalar('name')
      if (name) {
        const avatar = scalar('image_url') ?? scalar('avatar')
        const url = scalar('url')
        const props = [
          `name: ${JSON.stringify(name)}`,
          avatar ? `avatar: ${JSON.stringify(avatar)}` : null,
          url ? `url: ${JSON.stringify(url)}` : null,
        ].filter((part): part is string => part !== null)
        fm = fm.replace(
          /^[ \t]*authors[ \t]*:[^\n]*(?:\r?\n[ \t]+[^\n]+)*/m,
          `author: { ${props.join(', ')} }`,
        )
      } else {
        notes.push(
          '`authors` object has no `name`; map it to Boltdocs `author` manually.',
        )
      }
    } else if (/^[&*]/.test(inline)) {
      notes.push(
        '`authors` uses a YAML alias or anchor; map it to Boltdocs `author` manually.',
      )
    } else {
      // A plain scalar (quoted or not) is the author's name/id; keep it as the
      // single Boltdocs `author` value.
      fm = replaceFrontmatterField(fm, 'authors', 'author')
    }
  }
  if (
    hasFrontmatterField(fm, 'image') &&
    !hasFrontmatterField(fm, 'coverImage') &&
    !hasFrontmatterField(fm, 'cover')
  ) {
    fm = replaceFrontmatterField(fm, 'image', 'coverImage')
  }
  if (hasFrontmatterField(fm, 'keywords') && !hasFrontmatterField(fm, 'tags')) {
    notes.push(
      '`keywords` detected; consider mapping to `tags` or SEO metadata.',
    )
  }
  return fm
}

function transformContentFile(
  file: string,
  apply: boolean,
): { changed: boolean; notes: string[] } {
  const src = readText(file)
  if (src == null) return { changed: false, notes: [] }

  const parsed = parseFrontmatter(src)
  const notes: string[] = []
  let out = src

  if (parsed) {
    const fmRes = transformDocusaurusFrontmatter(parsed.raw)
    notes.push(...fmRes.notes)
    const body = convertDocusaurusAdmonitions(parsed.body)
    if (body.includes('<!--truncate-->')) {
      notes.push(
        '`<!--truncate-->` has no Boltdocs equivalent; put the summary in `excerpt` frontmatter manually.',
      )
    }
    out = serializeFrontmatter(fmRes.raw, body, parsed.eol, parsed.bom)
  } else {
    out = convertDocusaurusAdmonitions(src)
  }

  // Detect Docusaurus-only components/imports outside code fences (non-destructive)
  if (hasDocusaurusComponents(out)) {
    notes.push(
      'Contains @theme/*, @docusaurus/* or Tabs/TabItem components; replace them with Boltdocs equivalents.',
    )
  }

  if (out !== src) {
    if (apply) fs.writeFileSync(file, out, 'utf-8')
    return { changed: true, notes }
  }
  return { changed: false, notes }
}

function convertCategoryFiles(
  rootDocsDir: string,
  apply: boolean,
): {
  converted: number
  manual: MigrationFinding[]
} {
  let converted = 0
  const manual: MigrationFinding[] = []
  const dirs = [rootDocsDir, ...walkDirs(rootDocsDir)]

  for (const dir of dirs) {
    const jsonPath = path.join(dir, '_category_.json')
    const ymlPath = fs.existsSync(path.join(dir, '_category_.yml'))
      ? path.join(dir, '_category_.yml')
      : path.join(dir, '_category_.yaml')

    if (exists(ymlPath) && !exists(jsonPath)) {
      manual.push(
        finding({
          id: 'docusaurus/category-yaml',
          severity: 'warning',
          action: 'manual',
          title: 'Convert _category_.yml to meta.json manually',
          detail:
            'Found a YAML category file. Map `label`/`position`/`collapsible`/`collapsed` to Boltdocs `meta.json` (`title`, `order`, `collapsible`, `collapsed`).',
          file: path.relative(rootDocsDir, ymlPath).split(path.sep).join('/'),
        }),
      )
      continue
    }

    if (!exists(jsonPath)) continue
    const cat = readJsonRecord(jsonPath)
    if (!cat) {
      manual.push(
        finding({
          id: 'docusaurus/category-invalid',
          severity: 'warning',
          action: 'manual',
          title: 'Invalid _category_.json — convert manually',
          detail: 'Could not parse category file; create meta.json manually.',
          file: path.relative(rootDocsDir, jsonPath).split(path.sep).join('/'),
        }),
      )
      continue
    }

    const metaPath = path.join(dir, 'meta.json')
    if (exists(metaPath)) {
      manual.push(
        finding({
          id: 'docusaurus/category-meta-exists',
          severity: 'info',
          action: 'manual',
          title: 'meta.json already exists; review _category_.json mapping',
          detail:
            'Directory already has meta.json. Merge Docusaurus category fields (`label`, `position`, `collapsed`) if needed and remove _category_.json.',
          file: `${path.relative(rootDocsDir, dir).split(path.sep).join('/')}/`,
        }),
      )
      continue
    }

    const meta: Record<string, unknown> = {}
    if (typeof cat.label === 'string') meta.title = cat.label
    if (typeof cat.position === 'number') meta.order = cat.position
    if (typeof cat.collapsible === 'boolean') meta.collapsible = cat.collapsible
    if (typeof cat.collapsed === 'boolean') meta.collapsed = cat.collapsed
    if (cat.link || cat.className || cat.customProps) {
      manual.push(
        finding({
          id: 'docusaurus/category-link-props',
          severity: 'info',
          action: 'manual',
          title: 'Category link/custom props need manual review',
          detail:
            '`link`, `className`, or `customProps` in _category_.json are not auto-mapped. Adjust navigation/content structure as needed.',
          file: `${path.relative(rootDocsDir, dir).split(path.sep).join('/')}/`,
        }),
      )
    }

    if (Object.keys(meta).length > 0) {
      if (apply) {
        writeText(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
        try {
          fs.rmSync(jsonPath)
        } catch {}
      }
      converted++
    }
  }

  return { converted, manual }
}

/**
 * Copies Docusaurus translated docs into Boltdocs locale folders.
 *
 * Docusaurus stores them under
 * `i18n/<locale>/docusaurus-plugin-content-docs/{current,version-*}/`;
 * Boltdocs reads locales from `docs/<locale>/` (or `docs/<version>/<locale>/`
 * when versioning is enabled).
 */
function migrateLocalizedDocs(
  root: string,
  info: DocusaurusInfo,
  apply: boolean,
): { findings: MigrationFinding[]; applied: MigrationFinding[] } {
  const findings: MigrationFinding[] = []
  const applied: MigrationFinding[] = []
  const i18nRoot = path.join(root, 'i18n')
  if (!exists(i18nRoot)) return { findings, applied }

  for (const locale of info.locales) {
    if (locale.code === info.defaultLocale) continue
    const pluginDocs = path.join(
      i18nRoot,
      locale.code,
      'docusaurus-plugin-content-docs',
    )
    if (!exists(pluginDocs)) continue

    const current = path.join(pluginDocs, 'current')
    if (
      exists(current) &&
      !exists(path.join(root, info.docsDir, locale.code))
    ) {
      const dest = path.join(root, info.docsDir, locale.code)
      const f = finding({
        id: 'docusaurus/i18n-content',
        severity: 'warning',
        action: 'fixable',
        title: `Copy translated docs for locale '${locale.code}'`,
        detail: `Copies i18n/${locale.code}/docusaurus-plugin-content-docs/current into docs/${locale.code}/ and transforms frontmatter/admonitions.`,
        file: `i18n/${locale.code}/`,
        remediation: `i18n/${locale.code}/docusaurus-plugin-content-docs/current -> docs/${locale.code}/`,
      })
      findings.push(f)
      if (apply) {
        copyAndTransformMarkdown(current, dest, (file) =>
          transformContentFile(file, true),
        )
        applied.push(f)
      }
    }
  }

  return { findings, applied }
}

/** Copies versioned docs from `versioned_docs/version-*` into `docs/<version>/`. */
function migrateVersionedDocs(
  root: string,
  docsDir: string,
  apply: boolean,
): { findings: MigrationFinding[]; applied: MigrationFinding[] } {
  const findings: MigrationFinding[] = []
  const applied: MigrationFinding[] = []
  const versionedRoot = path.join(root, 'versioned_docs')
  if (!exists(versionedRoot)) return { findings, applied }

  for (const dir of listDirs(versionedRoot)) {
    if (!dir.startsWith('version-')) continue
    const versionPath = dir.slice('version-'.length)
    const dest = path.join(root, docsDir, versionPath)
    if (exists(dest)) continue
    const f = finding({
      id: 'docusaurus/version-content',
      severity: 'warning',
      action: 'fixable',
      title: `Copy versioned docs for '${versionPath}'`,
      detail: `Copies versioned_docs/${dir} into docs/${versionPath}/ and transforms frontmatter/admonitions.`,
      file: `versioned_docs/${dir}/`,
      remediation: `versioned_docs/${dir} -> docs/${versionPath}/`,
    })
    findings.push(f)
    if (apply) {
      copyAndTransformMarkdown(path.join(versionedRoot, dir), dest, (file) =>
        transformContentFile(file, true),
      )
      applied.push(f)
    }
  }
  return { findings, applied }
}

function generateBoltdocsConfig(info: DocusaurusInfo): string {
  const plugins = [...CORE_PLUGINS]
  if (info.hasBlog) plugins.push(RSS_PLUGIN)

  const versionModels: VersionModel[] = info.versionPaths.map((path) => ({
    path,
    label: path,
  }))

  return renderBoltdocsConfig({
    title: info.title ?? 'Documentation',
    description: info.description,
    favicon: info.favicon,
    base: info.base,
    docsDir: info.docsDir,
    siteUrl: info.siteUrl,
    githubRepo: info.githubRepo,
    editLink: info.editUrl
      ? `${info.editUrl.replace(/\/$/, '')}/:path`
      : undefined,
    navbar: info.navbar,
    socialLinks: info.socialLinks,
    i18n:
      info.locales.length > 0
        ? { defaultLocale: info.defaultLocale, locales: info.locales }
        : undefined,
    versions:
      versionModels.length > 0
        ? {
            defaultVersion: versionModels[versionModels.length - 1].path,
            prefix: info.versionPaths.some((p) => /^v\d/.test(p))
              ? 'v'
              : undefined,
            versions: versionModels,
          }
        : undefined,
    plugins,
  })
}

function updatePackageJson(
  root: string,
  docsDir: string,
  apply: boolean,
): { findings: MigrationFinding[]; applied: MigrationFinding[] } {
  const findings: MigrationFinding[] = []
  const applied: MigrationFinding[] = []
  const targetDeps: Record<string, string> = {
    boltdocs: '^4.0.0',
    '@bdocs/runtime': '^1.0.0',
    '@bdocs/theme-neutral': '^1.0.0',
    '@bdocs/plugin-search': '^0.1.0',
    '@bdocs/plugin-seo': '^0.1.0',
  }
  if (
    exists(path.join(root, 'blog')) ||
    exists(path.join(root, docsDir, '[blog]'))
  ) {
    targetDeps['@bdocs/plugin-rss'] = '^0.1.0'
  }

  planPackageJson(
    root,
    apply,
    {
      id: 'docusaurus/deps',
      title: 'Replace Docusaurus dependencies with Boltdocs packages',
      hasSourceConfig: DOCUSAURUS_CONFIG_FILES.some((f) =>
        exists(path.join(root, f)),
      ),
      isSourceDep: (k) =>
        k === '@docusaurus/core' || k.startsWith('@docusaurus/'),
      targetDeps,
      scripts: {
        'docs:dev': 'boltdocs dev',
        'docs:build': 'boltdocs build',
        'docs:preview': 'boltdocs preview',
        start: 'boltdocs dev',
        build: 'boltdocs build',
        serve: 'boltdocs preview',
      },
      replaceScriptsMatching: /docusaurus/i,
      remediation:
        'Remove @docusaurus/* deps, add Boltdocs packages, and update scripts to boltdocs dev/build/preview.',
    },
    findings,
    applied,
  )
  return { findings, applied }
}

export function migrateDocusaurus(root: string, apply: boolean): MigrationPlan {
  const findings: MigrationFinding[] = []
  const applied: MigrationFinding[] = []

  const configFile = findConfigFile(root, DOCUSAURUS_CONFIG_FILES)
  if (!configFile) {
    findings.push(
      finding({
        id: 'docusaurus/config-missing',
        severity: 'warning',
        action: 'manual',
        title: 'Docusaurus config not found',
        detail:
          'Could not locate docusaurus.config.*. Config migration will be limited; create or adjust boltdocs.config.ts manually.',
        file: '.',
      }),
    )
  }

  const configSource = configFile
    ? (readText(path.join(root, configFile)) ?? '')
    : ''
  const info = extractInfo(root, configSource)

  const boltConfigPath = path.join(root, 'boltdocs.config.ts')
  if (!exists(boltConfigPath)) {
    const f = finding({
      id: 'docusaurus/config',
      severity: 'blocking',
      action: 'fixable',
      title: 'Create boltdocs.config.ts from Docusaurus config',
      detail:
        'Generates a Boltdocs 4.0 starter config with detected title/description/base/favicon, navbar, github/edit links, i18n locales, versions and common plugins. Review sidebar, theme and integrations.',
      file: 'boltdocs.config.ts',
      remediation: 'A starter boltdocs.config.ts will be created.',
    })
    findings.push(f)
    if (apply) {
      writeText(boltConfigPath, generateBoltdocsConfig(info))
      applied.push(f)
    }
  } else {
    findings.push(
      finding({
        id: 'docusaurus/config-exists',
        severity: 'info',
        action: 'manual',
        title: 'boltdocs.config.ts already exists',
        detail:
          'Existing Boltdocs config was not overwritten. Merge Docusaurus settings (title, base, navbar, i18n, SEO) manually if needed.',
        file: 'boltdocs.config.ts',
      }),
    )
  }

  for (const unresolved of info.unresolved) {
    findings.push(
      finding({
        id: 'docusaurus/config-unresolved',
        severity: 'warning',
        action: 'manual',
        title: `Config value '${unresolved.key}' is not a literal`,
        detail: `The value '${unresolved.expression}' cannot be read without executing the config. Check the generated boltdocs.config.ts and set the real value by hand.`,
        file: configFile ?? 'docusaurus.config.*',
        line: unresolved.line,
        snippet: unresolved.expression,
      }),
    )
  }

  // i18n and versioned content: copy what we can, then flag the remaining
  // manual decisions (sidebars per version, translation completeness, etc.).
  if (info.hasI18n) {
    const i18nRes = migrateLocalizedDocs(root, info, apply)
    findings.push(...i18nRes.findings)
    applied.push(...i18nRes.applied)
    findings.push(
      finding({
        id: 'docusaurus/i18n',
        severity: 'info',
        action: 'manual',
        title: 'Review migrated i18n configuration and translations',
        detail:
          'Boltdocs i18n uses locale folders under docs/ and generates fallbacks for missing translations. Verify label/direction settings, locale-aware navbar labels and translated sidebars after migration.',
        file: configFile ?? 'i18n/',
      }),
    )
  }
  if (info.hasVersioning) {
    const versionRes = migrateVersionedDocs(root, info.docsDir, apply)
    findings.push(...versionRes.findings)
    applied.push(...versionRes.applied)
    findings.push(
      finding({
        id: 'docusaurus/versioning',
        severity: 'warning',
        action: 'manual',
        title: 'Review migrated versioned docs and per-version sidebars',
        detail:
          'versioned_docs/* was copied to docs/<version>/ and a versions config was generated. versioned_sidebars and version-specific navigation still need manual mapping.',
        file: 'versioned_docs/',
      }),
    )
  }
  // Sidebar mapping moves pages into category folders, so it must run before
  // the in-place content transformation below.
  const sidebarRes = migrateSidebars(root, info.docsDir, apply)
  findings.push(...sidebarRes.findings)
  applied.push(...sidebarRes.applied)

  const docsDir = path.join(root, info.docsDir)
  if (info.hasDocs) {
    // Inspect first so a second `--apply` reports nothing when all content is
    // already migrated. Dry-run and apply share this analysis.
    const files = walkFiles(docsDir, new Set(['.md', '.mdx']))
    const notes = new Set<string>()
    let willChange = false
    for (const file of files) {
      const res = transformContentFile(file, apply)
      willChange ||= res.changed
      for (const n of res.notes) notes.add(n)
    }
    const cat = convertCategoryFiles(docsDir, apply)
    willChange ||= cat.converted > 0
    findings.push(...cat.manual)
    for (const n of notes) {
      findings.push(
        finding({
          id: 'docusaurus/content-note',
          severity: 'info',
          action: 'manual',
          title: 'Content may need component/import adjustments',
          detail: n,
          file: `${info.docsDir}/`,
        }),
      )
    }

    if (willChange) {
      const f = finding({
        id: 'docusaurus/docs',
        severity: 'blocking',
        action: 'fixable',
        title: 'Convert docs/ content in place for Boltdocs',
        detail:
          'Transforms Markdown/MDX in docs/ (Boltdocs docsDir): rewrites common frontmatter and admonitions. _category_.json files are converted to meta.json where possible.',
        file: `${info.docsDir}/`,
        remediation:
          'Transform frontmatter/admonitions and convert _category_.json to meta.json.',
      })
      findings.push(f)
      if (apply) applied.push(f)
      if (cat.converted > 0) {
        findings.push(
          finding({
            id: 'docusaurus/categories-converted',
            severity: 'info',
            action: 'fixable',
            title: `Converted ${cat.converted} Docusaurus category file(s) to meta.json`,
            detail:
              'Mapped _category_.json fields (label/position/collapsible/collapsed) to Boltdocs meta.json.',
            file: `${info.docsDir}/`,
          }),
        )
      }
    }
  } else {
    findings.push(
      finding({
        id: 'docusaurus/docs-missing',
        severity: 'warning',
        action: 'manual',
        title: 'No docs/ directory found',
        detail:
          'Could not find Docusaurus docs/ content. Create a docs/ directory and move your documentation pages into it.',
        file: `${info.docsDir}/`,
      }),
    )
  }

  const blogSrc = path.join(root, 'blog')
  const blogDest = path.join(root, info.docsDir, '[blog]')
  if (exists(blogSrc) && !exists(blogDest)) {
    const f = finding({
      id: 'docusaurus/blog',
      severity: 'warning',
      action: 'fixable',
      title: 'Copy blog/ into docs/[blog]/',
      detail:
        'Copies blog posts into Boltdocs blog collection. Rewrites common frontmatter/admonitions; review date, author(s), tags, cover and truncation markers.',
      file: 'blog/',
      remediation: 'blog/ -> docs/[blog]/',
    })
    findings.push(f)
    if (apply) {
      const notes = new Set<string>()
      copyAndTransformMarkdown(blogSrc, blogDest, (file) => {
        for (const note of transformContentFile(file, true).notes)
          notes.add(note)
      })
      for (const note of notes) {
        findings.push(
          finding({
            id: 'docusaurus/blog-note',
            severity: 'info',
            action: 'manual',
            title: 'Blog frontmatter may need manual adjustment',
            detail: note,
            file: `${info.docsDir}/[blog]/`,
          }),
        )
      }
      const cat = convertCategoryFiles(blogDest, true)
      findings.push(...cat.manual)
      applied.push(f)
    }
  }

  const staticSrc = path.join(root, 'static')
  const publicDest = path.join(root, 'public')
  if (exists(staticSrc) && !exists(publicDest)) {
    const f = finding({
      id: 'docusaurus/static',
      severity: 'warning',
      action: 'fixable',
      title: 'Copy static/ assets into public/',
      detail:
        'Copies static assets to Boltdocs public directory. Update absolute URLs/references if base path changes.',
      file: 'static/',
      remediation: 'static/ -> public/',
    })
    findings.push(f)
    if (apply) {
      copyPath(staticSrc, publicDest)
      applied.push(f)
    }
  }

  if (exists(path.join(root, 'src', 'pages'))) {
    findings.push(
      finding({
        id: 'docusaurus/pages',
        severity: 'warning',
        action: 'manual',
        title: 'Custom React pages in src/pages/ need manual migration',
        detail:
          'Docusaurus src/pages are React routes. Migrate to Boltdocs external pages/components or equivalent structure manually.',
        file: 'src/pages/',
      }),
    )
  }
  if (
    exists(path.join(root, 'src', 'css')) ||
    exists(path.join(root, 'src', 'theme'))
  ) {
    findings.push(
      finding({
        id: 'docusaurus/theme-customization',
        severity: 'warning',
        action: 'manual',
        title: 'Theme/CSS customizations need manual migration',
        detail:
          'Docusaurus theme swizzling and custom CSS (src/css, src/theme) do not map 1:1. Recreate with @bdocs/theme-neutral, layout overrides, and CSS/plugins.',
        file: 'src/',
      }),
    )
  }

  findings.push(
    finding({
      id: 'docusaurus/mdx-components',
      severity: 'info',
      action: 'manual',
      title: 'Review MDX components and imports',
      detail:
        'Replace Docusaurus-specific components/imports (@theme/*, @docusaurus/*, Tabs/TabItem APIs, DocCardList, etc.) with Boltdocs equivalents.',
      file: `${info.docsDir}/`,
    }),
  )

  const linkRes = migrateLinks({
    root,
    docsDir: info.docsDir,
    framework: 'docusaurus',
    versions: info.versionPaths,
    apply,
  })
  findings.push(...linkRes.findings)
  applied.push(...linkRes.applied)

  const pkgRes = updatePackageJson(root, info.docsDir, apply)
  findings.push(...pkgRes.findings)
  applied.push(...pkgRes.applied)

  if (apply) {
    findings.push(
      finding({
        id: 'docusaurus/next-steps',
        severity: 'info',
        action: 'manual',
        title: 'Review migrated project and install dependencies',
        detail:
          'Run package install, then `boltdocs dev`. Verify routes, sidebar order, navbar, blog metadata, links/base, i18n/versioning, and replace Docusaurus-only components.',
        file: '.',
        remediation: 'pnpm install && pnpm docs:dev',
      }),
    )
  }

  return { findings, applied }
}
