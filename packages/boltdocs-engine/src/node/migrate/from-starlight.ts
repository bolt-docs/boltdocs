import fs from 'node:fs'
import path from 'node:path'
import type { MigrationFinding, MigrationPlan } from './types'
import {
  copyAndTransformMarkdown,
  copyPath,
  exists,
  findConfigFile,
  findUnresolvedConfigValues,
  finding,
  objectLiteralAfter,
  parseFrontmatter,
  pickField,
  planPackageJson,
  readText,
  serializeFrontmatter,
  stringPairs,
  type UnresolvedConfigValue,
  walkFiles,
  writeText,
} from './framework-common'
import {
  convertStarlightAsides,
  hasStarlightComponents,
} from './framework-content'
import {
  CORE_PLUGINS,
  renderBoltdocsConfig,
  type LocaleModel,
  type SocialLinkModel,
} from './framework-config'
import { migrateLinks } from './framework-links'
import { ASTRO_CONFIG_FILES } from './detect'

interface StarlightInfo {
  title?: string
  description?: string
  site?: string
  base?: string
  favicon?: string
  githubRepo?: string
  editUrl?: string
  socialLinks: SocialLinkModel[]
  locales: LocaleModel[]
  unresolved: UnresolvedConfigValue[]
  hasLocales: boolean
  configFile: string | null
}

function extractInfo(root: string, source: string): StarlightInfo {
  const configFile = findConfigFile(root, ASTRO_CONFIG_FILES)
  const title = pickField(source, 'title')
  const description = pickField(source, 'description')
  const site = pickField(source, 'site')
  const base = pickField(source, 'base')
  const favicon = pickField(source, 'favicon')

  const socialLiteral = objectLiteralAfter(source, 'social')
  const socialPairs = stringPairs(socialLiteral)
  const socialLinks: SocialLinkModel[] = socialPairs
    .filter(([key]) => /^(github|discord|x|bluesky|twitter)$/.test(key))
    .map(([key, link]) => ({
      icon: key === 'twitter' ? 'x' : key,
      link: /^https?:\/\//.test(link) ? link : `https://${link}`,
    }))
  const githubRepo = socialPairs.find(([k]) => k === 'github')?.[1]

  const editLiteral = objectLiteralAfter(source, 'editLink')
  const editUrl = editLiteral ? pickField(editLiteral, 'baseUrl') : undefined

  const localesLiteral = objectLiteralAfter(source, 'locales')
  const locales: LocaleModel[] = []

  // Starlight's common form is `locales: { root: { label }, es: { label } }`.
  if (localesLiteral) {
    for (const entry of localesLiteral.matchAll(
      /['"`]?([\w-]{2,10})['"`]?\s*:\s*\{([^{}]*)\}/g,
    )) {
      const label = pickField(entry[2], 'label')
      locales.push({ code: entry[1], label })
    }
    // Simple `code: 'Label'` form.
    for (const [code, label] of stringPairs(localesLiteral)) {
      if (
        /^[a-z]{2}(?:-[A-Za-z]{2})?$/.test(code) &&
        !locales.some((l) => l.code === code)
      ) {
        locales.push({ code, label })
      }
    }
  }

  let defaultLocale = pickField(source, 'defaultLocale')
  // Starlight uses `root` for unprefixed content. Boltdocs serves the default
  // locale from the root of docs/, so map it to a real code and drop the
  // pseudo-locale from the list.
  if (defaultLocale === 'root') {
    defaultLocale = 'en'
    const rootIndex = locales.findIndex((l) => l.code === 'root')
    if (rootIndex !== -1) locales.splice(rootIndex, 1)
  }
  if (defaultLocale && !locales.some((l) => l.code === defaultLocale)) {
    locales.unshift({ code: defaultLocale })
  }

  // Starlight accepts an array of locale codes, e.g. locales: ['en', 'es'].
  const arrayLocales = source.match(/\blocales\s*:\s*\[([^\]]*)\]/)?.[1]
  if (arrayLocales && locales.length === 0) {
    for (const code of arrayLocales.match(/['"`]([\w-]{2,10})['"`]/g) ?? []) {
      locales.push({ code: code.replace(/['"`]/g, '') })
    }
  }
  for (const code of ['es', 'fr', 'de', 'pt', 'it', 'ja']) {
    if (
      exists(path.join(root, 'src', 'content', 'docs', code)) &&
      !locales.some((l) => l.code === code)
    ) {
      locales.push({ code })
    }
  }

  return {
    title,
    description,
    site,
    base,
    favicon,
    githubRepo,
    editUrl,
    socialLinks,
    locales,
    unresolved: findUnresolvedConfigValues(source, [
      'title',
      'description',
      'site',
      'base',
      'favicon',
      'defaultLocale',
    ]),
    hasLocales: locales.length > 0 || /\blocales\s*:/.test(source),
    configFile,
  }
}

function transformStarlightFrontmatter(raw: string): {
  raw: string
  notes: string[]
} {
  const notes: string[] = []
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const lines = raw.split(/\r?\n/)

  // Line-based parsing: robust to CRLF and to arbitrary indentation.
  const start = lines.findIndex((line) => /^[ \t]*sidebar[ \t]*:/.test(line))
  if (start !== -1) {
    let end = start + 1
    while (
      end < lines.length &&
      /^[ \t]+/.test(lines[end]) &&
      lines[end].trim() !== ''
    ) {
      end++
    }
    const block = lines.slice(start + 1, end)
    const field = (name: string): string | undefined =>
      block
        .map(
          (line) =>
            new RegExp(`^[ \\t]+${name}[ \\t]*:[ \\t]*(.+?)[ \\t]*$`).exec(
              line,
            )?.[1],
        )
        .find((value): value is string => !!value)
        ?.trim()

    const order = field('order')
    const label = field('label')
    const hidden = field('hidden')
    const badgeRaw = field('badge')
    const badgeText = block
      .map((line) => /^[ \t]+text[ \t]*:[ \t]*(.+?)[ \t]*$/.exec(line)?.[1])
      .find((value): value is string => !!value)
      ?.trim()
    const hasAttrs = block.some((line) => /^[ \t]+attrs[ \t]*:/.test(line))
    const simpleBadge =
      badgeRaw && /^['"`]/.test(badgeRaw) ? badgeRaw : badgeText

    if (hasAttrs)
      notes.push('`sidebar.attrs` is not auto-mapped; review manually.')
    if (badgeRaw || badgeText)
      notes.push(
        'Starlight `sidebar.badge` may need adjustment to Boltdocs badge format.',
      )

    const additions: string[] = []
    if (order) additions.push(`sidebarPosition: ${order}`)
    if (label) additions.push(`sidebarLabel: ${label}`)
    if (hidden) additions.push(`sidebarHidden: ${hidden}`)
    if (simpleBadge) additions.push(`badge: ${simpleBadge}`)

    if (additions.length > 0 && !hasAttrs) {
      lines.splice(start, end - start, ...additions)
    } else {
      notes.push('Complex `sidebar` frontmatter may need manual migration.')
    }
  }

  const out = lines.join(eol)
  if (
    /^[ \t]*template[ \t]*:[ \t]*splash/m.test(out) ||
    /^[ \t]*hero[ \t]*:/m.test(out)
  ) {
    notes.push(
      'Starlight splash/hero frontmatter detected; migrate landing page layout manually.',
    )
  }
  if (/^[ \t]*(prev|next|editUrl|lastUpdated|banner|head)[ \t]*:/m.test(out)) {
    notes.push(
      'Starlight-specific frontmatter fields (prev/next/editUrl/banner/head/etc.) may need manual mapping.',
    )
  }

  return { raw: out, notes }
}

function transformContentFile(file: string): {
  changed: boolean
  notes: string[]
} {
  const src = readText(file)
  if (src == null) return { changed: false, notes: [] }

  const parsed = parseFrontmatter(src)
  const notes: string[] = []
  let out = src

  if (parsed) {
    const fmRes = transformStarlightFrontmatter(parsed.raw)
    notes.push(...fmRes.notes)
    const body = convertStarlightAsides(parsed.body)
    out = serializeFrontmatter(fmRes.raw, body, parsed.eol, parsed.bom)
  } else {
    out = convertStarlightAsides(src)
  }

  if (hasStarlightComponents(out)) {
    notes.push(
      'Contains Starlight/Astro components (Steps, CardGrid, LinkCard, Tabs, etc.); replace with Boltdocs/MDX equivalents.',
    )
  }

  if (out !== src) {
    fs.writeFileSync(file, out, 'utf-8')
    return { changed: true, notes }
  }
  return { changed: false, notes }
}

function generateBoltdocsConfig(info: StarlightInfo): string {
  return renderBoltdocsConfig({
    title: info.title ?? 'Documentation',
    description: info.description,
    favicon: info.favicon,
    base: info.base,
    siteUrl: info.site,
    githubRepo: info.githubRepo?.includes('/')
      ? info.githubRepo.replace(/^https?:\/\/github\.com\//, '')
      : undefined,
    editLink: info.editUrl
      ? `${info.editUrl.replace(/\/$/, '')}/:path`
      : undefined,
    socialLinks: info.socialLinks,
    i18n:
      info.locales.length > 0
        ? {
            defaultLocale: info.locales[0].code,
            locales: info.locales,
          }
        : undefined,
    plugins: [...CORE_PLUGINS],
  })
}

function updatePackageJson(
  root: string,
  apply: boolean,
): { findings: MigrationFinding[]; applied: MigrationFinding[] } {
  const findings: MigrationFinding[] = []
  const applied: MigrationFinding[] = []

  planPackageJson(
    root,
    apply,
    {
      id: 'starlight/deps',
      title: 'Replace Astro/Starlight dependencies with Boltdocs packages',
      hasSourceConfig: ASTRO_CONFIG_FILES.some((f) =>
        exists(path.join(root, f)),
      ),
      isSourceDep: (k) =>
        k === 'astro' ||
        k === '@astrojs/starlight' ||
        k.startsWith('@astrojs/'),
      targetDeps: {
        boltdocs: '^4.0.0',
        '@bdocs/runtime': '^1.0.0',
        '@bdocs/theme-neutral': '^1.0.0',
        '@bdocs/plugin-search': '^0.1.0',
        '@bdocs/plugin-seo': '^0.1.0',
      },
      scripts: {
        'docs:dev': 'boltdocs dev',
        'docs:build': 'boltdocs build',
        'docs:preview': 'boltdocs preview',
        dev: 'boltdocs dev',
        build: 'boltdocs build',
        preview: 'boltdocs preview',
      },
      replaceScriptsMatching: /astro/i,
      remediation:
        'Remove Astro/Starlight deps, add Boltdocs packages, and update scripts to boltdocs dev/build/preview.',
    },
    findings,
    applied,
  )
  return { findings, applied }
}

export function migrateStarlight(root: string, apply: boolean): MigrationPlan {
  const findings: MigrationFinding[] = []
  const applied: MigrationFinding[] = []

  const configFile = findConfigFile(root, ASTRO_CONFIG_FILES)
  const source = configFile ? (readText(path.join(root, configFile)) ?? '') : ''
  const info = extractInfo(root, source)

  const boltConfigPath = path.join(root, 'boltdocs.config.ts')
  if (!exists(boltConfigPath)) {
    const f = finding({
      id: 'starlight/config',
      severity: 'blocking',
      action: 'fixable',
      title: 'Create boltdocs.config.ts from Starlight/Astro config',
      detail:
        'Generates a Boltdocs 4.0 starter config with detected title/description/base, social links, edit link, locales and common plugins. Review sidebar, navbar and integrations.',
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
        id: 'starlight/config-exists',
        severity: 'info',
        action: 'manual',
        title: 'boltdocs.config.ts already exists',
        detail:
          'Existing Boltdocs config was not overwritten. Merge Starlight settings (title, sidebar, social, locales) manually if needed.',
        file: 'boltdocs.config.ts',
      }),
    )
  }

  for (const unresolved of info.unresolved) {
    findings.push(
      finding({
        id: 'starlight/config-unresolved',
        severity: 'warning',
        action: 'manual',
        title: `Config value '${unresolved.key}' is not a literal`,
        detail: `The value '${unresolved.expression}' cannot be read without executing the config. Check the generated boltdocs.config.ts and set the real value by hand.`,
        file: configFile ?? 'astro.config.*',
        line: unresolved.line,
        snippet: unresolved.expression,
      }),
    )
  }

  if (
    /sidebar\s*:/.test(source) ||
    exists(path.join(root, 'src', 'content', 'config.ts')) ||
    exists(path.join(root, 'src', 'content.config.ts'))
  ) {
    findings.push(
      finding({
        id: 'starlight/sidebar-schema',
        severity: 'warning',
        action: 'manual',
        title: 'Starlight sidebar/content config needs manual mapping',
        detail:
          'Starlight sidebar definitions and content collection schemas do not map 1:1. Recreate navigation with Boltdocs filesystem structure, route groups, frontmatter, and meta.json.',
        file: configFile ?? 'astro.config.*',
      }),
    )
  }
  if (info.hasLocales) {
    findings.push(
      finding({
        id: 'starlight/i18n',
        severity: 'warning',
        action: 'manual',
        title: 'Starlight locales/i18n detected — configure manually',
        detail:
          'Map Starlight `locales`/`defaultLocale` and localized content folders to Boltdocs `i18n` config and locale-prefixed docs structure.',
        file: configFile ?? '.',
      }),
    )
  }

  const contentSrc = path.join(root, 'src', 'content', 'docs')
  const docsDest = path.join(root, 'docs')
  // Once the content has been copied, `docs/` is populated: leave it alone on
  // subsequent runs so the migration stays idempotent.
  const docsAlreadyMigrated =
    exists(docsDest) && walkFiles(docsDest, new Set(['.md', '.mdx'])).length > 0
  if (exists(contentSrc) && !docsAlreadyMigrated) {
    const f = finding({
      id: 'starlight/docs',
      severity: 'blocking',
      action: 'fixable',
      title: 'Copy src/content/docs into docs/',
      detail:
        'Copies Markdown/MDX content into Boltdocs docs directory and rewrites common Starlight frontmatter and components (<Aside> → <Callout>).',
      file: 'src/content/docs/',
      remediation:
        'src/content/docs -> docs/ (with frontmatter/component transforms).',
    })
    findings.push(f)
    if (apply) {
      const componentNotes = new Set<string>()
      copyAndTransformMarkdown(contentSrc, docsDest, (file) => {
        for (const n of transformContentFile(file).notes) componentNotes.add(n)
      })
      for (const n of componentNotes) {
        findings.push(
          finding({
            id: 'starlight/content-note',
            severity: 'info',
            action: 'manual',
            title: 'Content may need component/frontmatter adjustments',
            detail: n,
            file: 'docs/',
          }),
        )
      }
      applied.push(f)
    }
  } else {
    findings.push(
      finding({
        id: 'starlight/docs-alt',
        severity: 'info',
        action: 'manual',
        title: 'No src/content/docs found',
        detail:
          'Could not find Starlight content at src/content/docs. If content lives elsewhere, move it under docs/ and adjust frontmatter/components.',
        file: '.',
      }),
    )
  }

  const publicSrc = path.join(root, 'public')
  const publicDest = path.join(root, 'public')
  if (
    exists(publicSrc) &&
    path.resolve(publicSrc) !== path.resolve(publicDest)
  ) {
    const f = finding({
      id: 'starlight/public',
      severity: 'warning',
      action: 'fixable',
      title: 'Copy public/ assets into public/',
      detail: 'Copies static assets to Boltdocs public directory.',
      file: 'public/',
      remediation: 'public/ -> public/',
    })
    findings.push(f)
    if (apply) {
      copyPath(publicSrc, publicDest)
      applied.push(f)
    }
  } else if (exists(publicSrc)) {
    findings.push(
      finding({
        id: 'starlight/public',
        severity: 'info',
        action: 'manual',
        title: 'public/ assets detected',
        detail:
          'Static assets already live in public/. Review references if base/path changes.',
        file: 'public/',
      }),
    )
  }

  if (
    exists(path.join(root, 'src', 'components')) ||
    exists(path.join(root, 'src', 'pages'))
  ) {
    findings.push(
      finding({
        id: 'starlight/components',
        severity: 'warning',
        action: 'manual',
        title: 'Astro components/pages need manual migration',
        detail:
          'Astro (.astro) components, pages, and Starlight overrides cannot be auto-converted. Reimplement with React/MDX components, Boltdocs layouts, or theme customization.',
        file: 'src/',
      }),
    )
  }

  findings.push(
    finding({
      id: 'starlight/content-collections',
      severity: 'info',
      action: 'manual',
      title: 'Review content collections and MDX usage',
      detail:
        'Adapt Starlight content collection schemas and Starlight-specific components/imports (Steps, CardGrid, LinkCard, Tabs, etc.) to Boltdocs conventions.',
      file: 'src/content/',
    }),
  )

  const linkRes = migrateLinks({
    root,
    docsDir: 'docs',
    framework: 'starlight',
    apply,
  })
  findings.push(...linkRes.findings)
  applied.push(...linkRes.applied)

  const pkgRes = updatePackageJson(root, apply)
  findings.push(...pkgRes.findings)
  applied.push(...pkgRes.applied)

  if (apply) {
    findings.push(
      finding({
        id: 'starlight/next-steps',
        severity: 'info',
        action: 'manual',
        title: 'Review migrated project and install dependencies',
        detail:
          'Run package install, then `boltdocs dev`. Verify routes, sidebar/frontmatter, navigation, i18n, and replace Astro/Starlight-only components.',
        file: '.',
        remediation: 'pnpm install && pnpm docs:dev',
      }),
    )
  }

  return { findings, applied }
}
