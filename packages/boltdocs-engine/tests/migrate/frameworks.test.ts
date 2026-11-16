import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { detectMigrationSource, migrate } from '../../src/node/migrate'

function tmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf-8')
}

function read(file: string): string {
  return fs.readFileSync(file, 'utf-8')
}

describe('framework migration detection', () => {
  it('detects docusaurus from config and deps', () => {
    const root = tmp('bolt-mig-det-docu-')
    write(
      path.join(root, 'package.json'),
      JSON.stringify({ dependencies: { '@docusaurus/core': '^3.0.0' } }),
    )
    write(path.join(root, 'docusaurus.config.js'), 'module.exports = {}')
    expect(detectMigrationSource(root)).toBe('docusaurus')
  })

  it('detects starlight from astro config and deps', () => {
    const root = tmp('bolt-mig-det-star-')
    write(
      path.join(root, 'package.json'),
      JSON.stringify({
        dependencies: { '@astrojs/starlight': '^0.30.0', astro: '^5.0.0' },
      }),
    )
    write(
      path.join(root, 'astro.config.mjs'),
      "import starlight from '@astrojs/starlight'; export default { integrations: [starlight({title:'Docs'})] }",
    )
    expect(detectMigrationSource(root)).toBe('starlight')
  })

  it('defaults to boltdocs when no foreign framework is found', () => {
    const root = tmp('bolt-mig-det-bolt-')
    write(path.join(root, 'package.json'), JSON.stringify({ name: 'x' }))
    expect(detectMigrationSource(root)).toBe('boltdocs')
  })

  it('respects explicit from option', () => {
    const root = tmp('bolt-mig-det-explicit-')
    write(path.join(root, 'package.json'), JSON.stringify({ name: 'x' }))
    expect(detectMigrationSource(root, 'docusaurus')).toBe('docusaurus')
    expect(detectMigrationSource(root, 'starlight')).toBe('starlight')
  })
})

describe('migrate from docusaurus', () => {
  it('reports and applies a basic docusaurus migration', () => {
    const root = tmp('bolt-mig-docu-')
    write(
      path.join(root, 'package.json'),
      JSON.stringify(
        {
          name: 'docusaurus-site',
          dependencies: { '@docusaurus/core': '^3.0.0', react: '^18.0.0' },
          scripts: { start: 'docusaurus start', build: 'docusaurus build' },
        },
        null,
        2,
      ),
    )
    write(
      path.join(root, 'docusaurus.config.js'),
      `module.exports = { title: 'My Site', tagline: 'Cool docs', url: 'https://example.com', baseUrl: '/', favicon: 'img/favicon.ico' }`,
    )
    write(
      path.join(root, 'docs', 'intro.md'),
      `---\ntitle: Intro\nsidebar_position: 1\nsidebar_label: Start\n---\n\n:::note Heads up\nHello\n:::\n`,
    )
    write(
      path.join(root, 'blog', '2024-01-01-hi.md'),
      `---\ntitle: Hi\n---\nPost`,
    )
    write(path.join(root, 'static', 'img', 'logo.png'), 'png')

    const dry = migrate({ root, apply: false, from: 'auto' })
    const ids = new Set(dry.findings.map((f) => f.id))
    expect(ids.has('docusaurus/config')).toBe(true)
    expect(ids.has('docusaurus/docs')).toBe(true)
    expect(ids.has('docusaurus/blog')).toBe(true)
    expect(ids.has('docusaurus/static')).toBe(true)
    expect(fs.existsSync(path.join(root, 'boltdocs.config.ts'))).toBe(false)

    const applied = migrate({ root, apply: true, from: 'auto' })
    expect(applied.applied.length).toBeGreaterThan(0)

    expect(fs.existsSync(path.join(root, 'boltdocs.config.ts'))).toBe(true)
    const config = read(path.join(root, 'boltdocs.config.ts'))
    expect(config).toContain('My Site')
    expect(config).toContain("from 'boltdocs'")

    const intro = read(path.join(root, 'docs', 'intro.md'))
    expect(intro).toContain('sidebarPosition: 1')
    expect(intro).toContain('sidebarLabel: Start')
    expect(intro).toContain('<Callout type="info"')
    expect(intro).not.toContain(':::note')

    expect(
      fs.existsSync(path.join(root, 'docs', '[blog]', '2024-01-01-hi.md')),
    ).toBe(true)
    expect(fs.existsSync(path.join(root, 'public', 'img', 'logo.png'))).toBe(
      true,
    )

    const pkg = JSON.parse(read(path.join(root, 'package.json')))
    expect(pkg.dependencies.boltdocs).toBeDefined()
    expect(pkg.dependencies['@bdocs/runtime']).toBeDefined()
    expect(pkg.dependencies['@bdocs/theme-neutral']).toBeDefined()
    expect(pkg.dependencies['@docusaurus/core']).toBeUndefined()
  })
})

describe('migrate from starlight', () => {
  it('reports and applies a basic starlight migration', () => {
    const root = tmp('bolt-mig-star-')
    write(
      path.join(root, 'package.json'),
      JSON.stringify(
        {
          name: 'starlight-site',
          dependencies: { astro: '^5.0.0', '@astrojs/starlight': '^0.30.0' },
        },
        null,
        2,
      ),
    )
    write(
      path.join(root, 'astro.config.mjs'),
      `import starlight from '@astrojs/starlight';\nexport default { integrations: [starlight({ title: 'Starlight Docs' })] }\n`,
    )
    write(
      path.join(root, 'src', 'content', 'docs', 'guides', 'intro.mdx'),
      `---\ntitle: Intro\nsidebar:\n  order: 1\n  label: Getting Started\n---\n\n<Aside type="tip" title="Tip">Be nice</Aside>\n`,
    )
    write(path.join(root, 'public', 'favicon.svg'), '<svg/>')

    const dry = migrate({ root, apply: false, from: 'auto' })
    const ids = new Set(dry.findings.map((f) => f.id))
    expect(ids.has('starlight/config')).toBe(true)
    expect(ids.has('starlight/docs')).toBe(true)

    migrate({ root, apply: true, from: 'auto' })

    expect(fs.existsSync(path.join(root, 'boltdocs.config.ts'))).toBe(true)
    const config = read(path.join(root, 'boltdocs.config.ts'))
    expect(config).toContain('Starlight Docs')

    const intro = read(path.join(root, 'docs', 'guides', 'intro.mdx'))
    expect(intro).toContain('sidebarPosition: 1')
    expect(intro).toContain('sidebarLabel: Getting Started')
    expect(intro).toContain('<Callout type="tip"')
    expect(intro).not.toContain('<Aside')

    expect(fs.existsSync(path.join(root, 'public', 'favicon.svg'))).toBe(true)

    const pkg = JSON.parse(read(path.join(root, 'package.json')))
    expect(pkg.dependencies.boltdocs).toBeDefined()
    expect(pkg.dependencies['@astrojs/starlight']).toBeUndefined()
  })
})

describe('framework config fidelity', () => {
  it('generates a rich docusaurus config (navbar, github, edit link, i18n, versions)', () => {
    const root = tmp('bolt-mig-docu-config-')
    write(
      path.join(root, 'package.json'),
      JSON.stringify({
        dependencies: { '@docusaurus/core': '^3.0.0', react: '^18.0.0' },
      }),
    )
    write(
      path.join(root, 'docusaurus.config.js'),
      [
        'const config = {',
        "  title: 'Docs Site',",
        "  tagline: 'All the docs',",
        "  url: 'https://docs.example.com',",
        "  baseUrl: '/docs/',",
        "  favicon: 'img/favicon.ico',",
        "  organizationName: 'acme',",
        "  projectName: 'docs-site',",
        "  editUrl: 'https://github.com/acme/docs-site/edit/main/docs/',",
        '  i18n: {',
        "    defaultLocale: 'en',",
        "    locales: ['en', 'es', 'fr'],",
        '  },',
        '  themeConfig: {',
        '    navbar: {',
        '      items: [',
        "        { to: '/docs/intro', label: 'Intro' },",
        "        { href: 'https://example.com', label: 'External' },",
        '      ],',
        '    },',
        '  },',
        '}',
        'module.exports = config',
      ].join('\n'),
    )
    write(
      path.join(
        root,
        'i18n',
        'es',
        'docusaurus-plugin-content-docs',
        'current',
        'intro.md',
      ),
      '---\ntitle: Intro ES\n---\nHola',
    )
    write(
      path.join(root, 'versioned_docs', 'version-v1', 'intro.md'),
      '---\ntitle: Intro v1\n---\nViejo',
    )
    write(path.join(root, 'versions.json'), JSON.stringify(['v1']))
    write(
      path.join(root, 'docs', 'intro.md'),
      '---\ntitle: Intro\nsidebar_position: 2\n---\nHola',
    )
    write(
      path.join(root, 'docs', 'guides', '_category_.json'),
      JSON.stringify({ label: 'Guides', position: 3, collapsed: false }),
    )

    const plan = migrate({ root, apply: false })
    expect(plan.findings.some((f) => f.id === 'docusaurus/i18n-content')).toBe(
      true,
    )
    expect(
      plan.findings.some((f) => f.id === 'docusaurus/version-content'),
    ).toBe(true)
    expect(fs.existsSync(path.join(root, 'boltdocs.config.ts'))).toBe(false)

    migrate({ root, apply: true })

    const config = read(path.join(root, 'boltdocs.config.ts'))
    expect(config).toContain("base: '/docs/'")
    expect(config).toContain("githubRepo: 'acme/docs-site'")
    expect(config).toContain(
      "editLink: 'https://github.com/acme/docs-site/edit/main/docs/:path'",
    )
    expect(config).toContain("{ label: 'Intro', href: '/docs/intro' }")
    expect(config).not.toContain('External')
    expect(config).toContain("icon: 'github'")
    expect(config).toContain("defaultLocale: 'en'")
    expect(config).toContain("'es': 'Español'") // no explicit label -> code as label
    expect(config).toContain("defaultVersion: 'v1'")
    expect(config).toContain('// TODO: configure SEO site URL')

    // Category file became meta.json and was removed.
    expect(read(path.join(root, 'docs', 'guides', 'meta.json'))).toContain(
      '"title": "Guides"',
    )
    expect(
      fs.existsSync(path.join(root, 'docs', 'guides', '_category_.json')),
    ).toBe(false)

    // Locale + version content copied and transformed.
    expect(read(path.join(root, 'docs', 'es', 'intro.md'))).toContain(
      'Intro ES',
    )
    expect(read(path.join(root, 'docs', 'v1', 'intro.md'))).toContain(
      'Intro v1',
    )
  })

  it('generates a rich starlight config (socials, edit link, locales, description)', () => {
    const root = tmp('bolt-mig-star-config-')
    write(
      path.join(root, 'package.json'),
      JSON.stringify({
        dependencies: { astro: '^5.0.0', '@astrojs/starlight': '^0.30.0' },
      }),
    )
    write(
      path.join(root, 'astro.config.mjs'),
      [
        "import starlight from '@astrojs/starlight'",
        'export default {',
        "  site: 'https://star.example.com',",
        "  base: '/handbook',",
        '  integrations: [starlight({',
        "    title: 'Handbook',",
        "    description: 'A friendly handbook',",
        "    favicon: '/favicon.svg',",
        "    defaultLocale: 'root',",
        '    locales: {',
        "      root: { label: 'English' },",
        "      es: { label: 'Español' },",
        '    },',
        '    social: {',
        "      github: 'https://github.com/acme/handbook',",
        "      discord: 'https://discord.gg/acme',",
        '    },',
        '    editLink: {',
        "      baseUrl: 'https://github.com/acme/handbook/edit/main/docs/',",
        '    },',
        '  })],',
        '}',
      ].join('\n'),
    )
    write(
      path.join(root, 'src', 'content', 'docs', 'es', 'intro.md'),
      '---\ntitle: Intro ES\n---\nHola',
    )

    migrate({ root, apply: true })

    const config = read(path.join(root, 'boltdocs.config.ts'))
    expect(config).toContain("description: 'A friendly handbook'")
    expect(config).toContain("base: '/handbook'")
    expect(config).toContain("githubRepo: 'acme/handbook'")
    expect(config).toContain("icon: 'discord'")
    expect(config).toContain(
      "editLink: 'https://github.com/acme/handbook/edit/main/docs/:path'",
    )
    expect(config).toContain("defaultLocale: 'en'")
    expect(config).toContain("'es': 'Español'")
    expect(config).toContain('localeConfigs')
    expect(config).toContain('// TODO: configure SEO site URL')
    expect(read(path.join(root, 'docs', 'es', 'intro.md'))).toContain(
      'Intro ES',
    )
  })

  it('never writes on a dry run', () => {
    const root = tmp('bolt-mig-dry-')
    write(
      path.join(root, 'package.json'),
      JSON.stringify({ dependencies: { '@docusaurus/core': '^3.0.0' } }),
    )
    write(
      path.join(root, 'docusaurus.config.js'),
      "module.exports = { title: 'X' }",
    )
    write(path.join(root, 'docs', 'a.md'), '---\nsidebar_position: 1\n---\nA')

    const plan = migrate({ root, apply: false })
    expect(plan.applied).toEqual([])
    expect(fs.existsSync(path.join(root, 'boltdocs.config.ts'))).toBe(false)
    expect(read(path.join(root, 'docs', 'a.md'))).toContain(
      'sidebar_position: 1',
    )
    expect(read(path.join(root, 'package.json'))).toContain('@docusaurus/core')
  })
})
