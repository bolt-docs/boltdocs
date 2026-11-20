import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { detectMigrationSource, migrate } from '../../src/node/migrate'
import {
  convertDocusaurusAdmonitions,
  convertStarlightAsides,
  splitCodeFences,
} from '../../src/node/migrate/framework-content'

function tmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function write(file: string, content: string | Buffer): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

function read(file: string): string {
  return fs.readFileSync(file, 'utf-8')
}

function bytes(file: string): Buffer {
  return fs.readFileSync(file)
}

function docPackage(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    name: 'docs-site',
    dependencies: { '@docusaurus/core': '^3.10.2', react: '^19.0.0' },
    scripts: { start: 'docusaurus start', build: 'docusaurus build' },
    ...extra,
  })
}

function starPackage(): string {
  return JSON.stringify({
    name: 'starlight-site',
    dependencies: { astro: '^5.0.0', '@astrojs/starlight': '^0.36.0' },
    scripts: { dev: 'astro dev', build: 'astro build' },
  })
}

describe('source detection matrix', () => {
  it('detects Docusaurus 3 TS configs and devDependencies', () => {
    const root = tmp('bolt-rob-det-docusaurus-')
    write(
      path.join(root, 'package.json'),
      JSON.stringify({
        devDependencies: { '@docusaurus/core': '^3.10.2' },
      }),
    )
    write(
      path.join(root, 'docusaurus.config.ts'),
      "import { defineConfig } from '@docusaurus/core'\nexport default defineConfig({ title: 'Docs' })",
    )
    expect(detectMigrationSource(root)).toBe('docusaurus')
  })

  it('detects Docusaurus from sidebars alone', () => {
    const root = tmp('bolt-rob-det-sidebars-')
    write(path.join(root, 'sidebars.js'), 'module.exports = {}')
    expect(detectMigrationSource(root)).toBe('docusaurus')
  })

  it('detects Starlight from a modern Astro 5 config', () => {
    const root = tmp('bolt-rob-det-starlight-')
    write(path.join(root, 'package.json'), starPackage())
    write(
      path.join(root, 'astro.config.mjs'),
      "import starlight from '@astrojs/starlight'\nexport default { integrations: [starlight()] }",
    )
    expect(detectMigrationSource(root)).toBe('starlight')
  })

  it('does not classify a plain Astro site as Starlight', () => {
    const root = tmp('bolt-rob-det-astro-')
    write(
      path.join(root, 'package.json'),
      JSON.stringify({ dependencies: { astro: '^5.0.0' } }),
    )
    write(path.join(root, 'astro.config.mjs'), 'export default {}')
    expect(detectMigrationSource(root)).toBe('boltdocs')
  })

  it('honors an explicit --from even when autodetection disagrees', () => {
    const root = tmp('bolt-rob-det-explicit-')
    write(
      path.join(root, 'package.json'),
      JSON.stringify({ dependencies: { astro: '^5.0.0' } }),
    )
    expect(detectMigrationSource(root, 'starlight')).toBe('starlight')
  })

  it('survives an invalid package.json during detection', () => {
    const root = tmp('bolt-rob-det-badmanifest-')
    write(path.join(root, 'package.json'), '{ not json')
    expect(detectMigrationSource(root)).toBe('boltdocs')
    expect(() => migrate({ root, apply: false })).not.toThrow()
  })
})

describe('Docusaurus config parsing', () => {
  it('reads quoted keys and ignores fake values in comments', () => {
    const root = tmp('bolt-rob-docu-config-')
    write(path.join(root, 'package.json'), docPackage())
    write(
      path.join(root, 'docusaurus.config.ts'),
      [
        "import { defineConfig } from '@docusaurus/types'",
        'export default defineConfig({',
        "  // title: 'Fake comment title',",
        "  'title': 'Real Title',",
        '  "tagline": "Real tagline",',
        "  baseUrl: '/guide/',",
        "  url: 'https://guide.example.com',",
        "  favicon: 'img/favicon.ico',",
        "  organizationName: 'acme',",
        "  projectName: 'guide',",
        "  editUrl: 'https://github.com/acme/guide/edit/main/docs/',",
        '  themeConfig: {',
        '    navbar: {',
        '      items: [',
        "        { to: '/guide/start', label: 'Start' },",
        "        { to: 'reference', label: 'Reference' },",
        '      ],',
        '    },',
        '  },',
        '})',
      ].join('\n'),
    )

    migrate({ root, apply: true })
    const config = read(path.join(root, 'boltdocs.config.ts'))
    expect(config).toContain("title: 'Real Title'")
    expect(config).not.toContain('Fake comment title')
    expect(config).toContain("description: 'Real tagline'")
    expect(config).toContain("base: '/guide/'")
    expect(config).toContain("githubRepo: 'acme/guide'")
    expect(config).toContain(
      "editLink: 'https://github.com/acme/guide/edit/main/docs/:path'",
    )
    expect(config).toContain("{ label: 'Start', href: '/guide/start' }")
    expect(config).toContain("{ label: 'Reference', href: '/reference' }")
  })

  it('supports CommonJS module.exports configs', () => {
    const root = tmp('bolt-rob-docu-cjs-')
    write(path.join(root, 'package.json'), docPackage())
    write(
      path.join(root, 'docusaurus.config.js'),
      [
        'module.exports = {',
        "  title: 'CJS Site',",
        "  favicon: 'img/favicon.ico',",
        '}',
      ].join('\n'),
    )
    migrate({ root, apply: true })
    expect(read(path.join(root, 'boltdocs.config.ts'))).toContain(
      "title: 'CJS Site'",
    )
  })
})

describe('Docusaurus content conversion', () => {
  it('preserves CRLF and BOM, handles indented keys and nested admonitions', () => {
    const root = tmp('bolt-rob-docu-content-')
    write(path.join(root, 'package.json'), docPackage())
    write(
      path.join(root, 'docusaurus.config.js'),
      "module.exports = { title: 'X' }",
    )
    const body = [
      '---',
      'title: Intro',
      '  sidebar_position: 2',
      'hide_table_of_contents: true',
      '---',
      ':::note[Outer title]',
      'Outside',
      '',
      '  :::tip Inner',
      '  Inside',
      '  :::',
      ':::',
      '',
      '- list item',
      '  :::warning Careful',
      '  List note',
      '  :::',
    ].join('\r\n')
    write(path.join(root, 'docs', 'intro.md'), `\uFEFF${body}`)

    const plan = migrate({ root, apply: true })
    const out = bytes(path.join(root, 'docs', 'intro.md'))
    const text = out.toString('utf-8')
    expect(text.startsWith('\uFEFF')).toBe(true)
    expect(text).not.toContain('\n\n') // CRLF preserved (no lone LF introduced)
    expect(text).toContain('sidebarPosition: 2')
    expect(text).toContain('<Callout type="info" title="Outer title">')
    expect(text).toContain('<Callout type="tip" title="Inner">')
    expect(text).toContain('<Callout type="warning" title="Careful">')
    expect(text).not.toContain(':::')
    expect(
      plan.findings.some((f) => f.detail.includes('hide_table_of_contents')),
    ).toBe(true)
  })

  it('never converts admonitions inside fenced code blocks', () => {
    const root = tmp('bolt-rob-docu-fence-')
    write(path.join(root, 'package.json'), docPackage())
    write(
      path.join(root, 'docusaurus.config.js'),
      "module.exports = { title: 'X' }",
    )
    write(
      path.join(root, 'docs', 'fence.mdx'),
      [
        '---',
        'title: Fences',
        '---',
        '```md',
        ':::note Example',
        'This stays literal',
        ':::',
        '```',
        '',
        ':::tip Real',
        'Convert me',
        ':::',
      ].join('\n'),
    )
    migrate({ root, apply: true })
    const text = read(path.join(root, 'docs', 'fence.mdx'))
    expect(text).toContain('```md\n:::note Example')
    expect(text.match(/<Callout/g)).toHaveLength(1)
    expect(text).toContain('<Callout type="tip" title="Real">')
  })

  it('leaves unterminated admonitions untouched and is idempotent', () => {
    const root = tmp('bolt-rob-docu-unclosed-')
    write(path.join(root, 'package.json'), docPackage())
    write(
      path.join(root, 'docusaurus.config.js'),
      "module.exports = { title: 'X' }",
    )
    write(
      path.join(root, 'docs', 'broken.md'),
      '---\ntitle: Broken\n---\n:::note Never closed\nText\n',
    )
    migrate({ root, apply: true })
    expect(read(path.join(root, 'docs', 'broken.md'))).toContain(
      ':::note Never closed',
    )

    // Idempotency: a second apply finds no fixable changes other than the
    // config/deps that were already migrated.
    const second = migrate({ root, apply: false })
    expect(second.findings.filter((f) => f.action === 'fixable')).toEqual([])
  })

  it('converts _category_.json and reports YAML/conflicts', () => {
    const root = tmp('bolt-rob-docu-categories-')
    write(path.join(root, 'package.json'), docPackage())
    write(
      path.join(root, 'docusaurus.config.js'),
      "module.exports = { title: 'X' }",
    )
    write(
      path.join(root, 'docs', 'guides', '_category_.json'),
      JSON.stringify({ label: 'Guides', position: 2, collapsed: false }),
    )
    write(
      path.join(root, 'docs', 'api', '_category_.yml'),
      'label: API\nposition: 3\n',
    )
    write(
      path.join(root, 'docs', 'conflict', '_category_.json'),
      JSON.stringify({ label: 'Conflict' }),
    )
    write(
      path.join(root, 'docs', 'conflict', 'meta.json'),
      JSON.stringify({ title: 'Existing' }),
    )

    const plan = migrate({ root, apply: true })
    expect(read(path.join(root, 'docs', 'guides', 'meta.json'))).toContain(
      '"order": 2',
    )
    expect(
      fs.existsSync(path.join(root, 'docs', 'guides', '_category_.json')),
    ).toBe(false)
    expect(plan.findings.some((f) => f.id === 'docusaurus/category-yaml')).toBe(
      true,
    )
    expect(
      plan.findings.some((f) => f.id === 'docusaurus/category-meta-exists'),
    ).toBe(true)
  })

  it('migrates locale and versioned content with config from filesystem', () => {
    const root = tmp('bolt-rob-docu-i18n-')
    write(path.join(root, 'package.json'), docPackage())
    write(
      path.join(root, 'docusaurus.config.js'),
      "module.exports = { title: 'X', i18n: { defaultLocale: 'en', locales: ['en', 'fr'] } }",
    )
    write(
      path.join(
        root,
        'i18n',
        'fr',
        'docusaurus-plugin-content-docs',
        'current',
        'intro.md',
      ),
      '---\ntitle: Intro FR\nsidebar_position: 1\n---\nBonjour',
    )
    write(
      path.join(root, 'versioned_docs', 'version-v2', 'intro.md'),
      '---\ntitle: Intro v2\n---\nV2',
    )
    write(path.join(root, 'versions.json'), JSON.stringify(['v2']))
    write(path.join(root, 'docs', 'intro.md'), '---\ntitle: Intro\n---\nHello')

    migrate({ root, apply: true })
    const config = read(path.join(root, 'boltdocs.config.ts'))
    expect(config).toContain("defaultLocale: 'en'")
    expect(config).toContain("'fr': 'Français'")
    expect(config).toContain("defaultVersion: 'v2'")
    expect(read(path.join(root, 'docs', 'fr', 'intro.md'))).toContain(
      'sidebarPosition: 1',
    )
    expect(read(path.join(root, 'docs', 'v2', 'intro.md'))).toContain(
      'Intro v2',
    )
  })
})

describe('Starlight config and content robustness', () => {
  it('reads quoted keys, all social platforms and nested locales', () => {
    const root = tmp('bolt-rob-star-config-')
    write(path.join(root, 'package.json'), starPackage())
    write(
      path.join(root, 'astro.config.mjs'),
      [
        "import starlight from '@astrojs/starlight'",
        'export default {',
        "  'site': 'https://star.example.com',",
        "  base: '/docs',",
        '  integrations: [starlight({',
        "    'title': 'Starlight Handbook',",
        "    description: 'Learn things',",
        "    defaultLocale: 'root',",
        '    locales: {',
        "      'root': { label: 'English' },",
        "      'es': { label: 'Español' },",
        "      'pt': { label: 'Português' },",
        '    },',
        '    social: {',
        "      github: 'https://github.com/acme/handbook',",
        "      x: 'https://x.com/acme',",
        "      bluesky: 'bsky.app/profile/acme',",
        '    },',
        "    editLink: { baseUrl: 'https://github.com/acme/handbook/edit/main/docs/' },",
        '  })],',
        '}',
      ].join('\n'),
    )
    migrate({ root, apply: true })
    const config = read(path.join(root, 'boltdocs.config.ts'))
    expect(config).toContain("title: 'Starlight Handbook'")
    expect(config).toContain("defaultLocale: 'en'")
    expect(config).toContain("'es': 'Español'")
    expect(config).toContain("'pt': 'Português'")
    expect(config).toContain("icon: 'x'")
    expect(config).toContain("icon: 'bluesky'")
    expect(config).toContain('https://bsky.app/profile/acme')
    expect(config).toContain(
      "editLink: 'https://github.com/acme/handbook/edit/main/docs/:path'",
    )
  })

  it('converts nested Asides, respects code fences, preserves CRLF/BOM and is idempotent', () => {
    const root = tmp('bolt-rob-star-content-')
    write(path.join(root, 'package.json'), starPackage())
    write(
      path.join(root, 'astro.config.mjs'),
      "export default { integrations: [starlight({ title: 'X' })] }",
    )
    const body = [
      '---',
      'title: Asides',
      'sidebar:',
      '  order: 3',
      '  label: Guía',
      '---',
      '<Aside type="note" title="Outer">',
      'Outside',
      '<Aside type="caution">Inside</Aside>',
      '</Aside>',
      '',
      '```mdx',
      '<Aside type="tip">Literal example</Aside>',
      '```',
      '',
      '<Steps>',
      '1. Do this',
      '</Steps>',
    ].join('\r\n')
    write(
      path.join(root, 'src', 'content', 'docs', 'guide.mdx'),
      `\uFEFF${body}`,
    )

    const plan = migrate({ root, apply: true })
    const out = bytes(path.join(root, 'docs', 'guide.mdx')).toString('utf-8')
    expect(out.startsWith('\uFEFF')).toBe(true)
    expect(out).toContain('sidebarPosition: 3')
    expect(out).toContain('sidebarLabel: Guía')
    expect(out.match(/<Callout/g)).toHaveLength(2)
    expect(out).toContain('<Callout type="info" title="Outer">')
    expect(out).toContain('<Callout type="warning">Inside</Callout>')
    expect(out).toContain('```mdx\r\n<Aside type="tip">Literal example</Aside>')
    expect(out).toContain('<Steps>')
    expect(
      plan.findings.some((f) =>
        f.detail.includes('Starlight/Astro components'),
      ),
    ).toBe(true)

    const before = bytes(path.join(root, 'docs', 'guide.mdx'))
    migrate({ root, apply: true })
    expect(bytes(path.join(root, 'docs', 'guide.mdx'))).toEqual(before)
  })
})

describe('manifest and converter edge cases', () => {
  it('adds dependencies and scripts to a manifest that has none', () => {
    const root = tmp('bolt-rob-manifest-empty-')
    write(path.join(root, 'package.json'), JSON.stringify({ name: 'bare' }))
    write(
      path.join(root, 'docusaurus.config.js'),
      "module.exports = { title: 'X' }",
    )
    migrate({ root, apply: true })
    const pkg = JSON.parse(read(path.join(root, 'package.json')))
    expect(pkg.dependencies.boltdocs).toBe('^4.0.0')
    expect(pkg.scripts['docs:dev']).toBe('boltdocs dev')
    expect(pkg.scripts.start).toBe('boltdocs dev')
  })

  it('does not crash when dependencies is an array', () => {
    const root = tmp('bolt-rob-manifest-array-')
    write(
      path.join(root, 'package.json'),
      JSON.stringify({ name: 'x', dependencies: ['@docusaurus/core'] }),
    )
    write(
      path.join(root, 'docusaurus.config.js'),
      "module.exports = { title: 'X' }",
    )
    expect(() => migrate({ root, apply: true })).not.toThrow()
  })

  it('is idempotent for manifest rewrites on both frameworks', () => {
    for (const [prefix, pkgText, configFile, configText] of [
      [
        'docu',
        docPackage(),
        'docusaurus.config.js',
        "module.exports = { title: 'X' }",
      ],
      [
        'star',
        starPackage(),
        'astro.config.mjs',
        "export default { integrations: [starlight({ title: 'X' })] }",
      ],
    ] as const) {
      const root = tmp(`bolt-rob-manifest-idem-${prefix}-`)
      write(path.join(root, 'package.json'), pkgText)
      write(path.join(root, configFile), configText)
      migrate({ root, apply: true })
      const second = migrate({ root, apply: false })
      expect(second.findings.filter((f) => f.action === 'fixable')).toEqual([])
    }
  })
})

describe('generated output safety', () => {
  it('produces syntactically valid configs for both frameworks', () => {
    for (const [prefix, pkgText, configFile, configText] of [
      [
        'docu',
        docPackage(),
        'docusaurus.config.js',
        "module.exports = { title: 'It\\'s Docs', organizationName: 'acme', projectName: 'docs' }",
      ],
      [
        'star',
        starPackage(),
        'astro.config.mjs',
        "export default { integrations: [starlight({ title: 'Star Docs' })] }",
      ],
    ] as const) {
      const root = tmp(`bolt-rob-syntax-${prefix}-`)
      write(path.join(root, 'package.json'), pkgText)
      write(path.join(root, configFile), configText)
      migrate({ root, apply: true })
      const target = path.join(root, 'generated-config.mjs')
      write(target, read(path.join(root, 'boltdocs.config.ts')))
      expect(() =>
        execFileSync(process.execPath, ['--check', target]),
      ).not.toThrow()
    }
  })

  it('writes nothing at all during a full dry run', () => {
    const root = tmp('bolt-rob-full-dry-')
    write(path.join(root, 'package.json'), docPackage())
    write(
      path.join(root, 'docusaurus.config.js'),
      "module.exports = { title: 'X', i18n: { defaultLocale: 'en', locales: ['en', 'es'] } }",
    )
    write(
      path.join(root, 'docs', 'intro.md'),
      '---\ntitle: Intro\nsidebar_position: 1\n---\n:::note Hi\nthere\n:::',
    )
    write(
      path.join(root, 'docs', 'guides', '_category_.json'),
      JSON.stringify({ label: 'Guides' }),
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
      '---\ntitle: ES\n---\nHola',
    )
    write(
      path.join(root, 'versioned_docs', 'version-v1', 'intro.md'),
      '---\ntitle: V1\n---\nV1',
    )
    write(path.join(root, 'blog', 'post.md'), '---\ntitle: Post\n---\nPost')
    write(path.join(root, 'static', 'logo.svg'), '<svg/>')

    const before = new Map<string, string>()
    const collect = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) collect(full)
        else
          before.set(path.relative(root, full), fs.readFileSync(full, 'utf-8'))
      }
    }
    collect(root)

    migrate({ root, apply: false })

    const after = new Map<string, string>()
    const collectAfter = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) collectAfter(full)
        else
          after.set(path.relative(root, full), fs.readFileSync(full, 'utf-8'))
      }
    }
    collectAfter(root)
    expect([...after.keys()].sort()).toEqual([...before.keys()].sort())
    for (const [name, content] of before) expect(after.get(name)).toBe(content)
  })
})

describe('converter units', () => {
  it('splitCodeFences marks fenced regions and preserves text', () => {
    const src = 'before\n```ts\n:::note\n```\nafter\n'
    const segments = splitCodeFences(src)
    expect(segments.map((s) => s.fenced)).toEqual([false, true, false])
    expect(segments.map((s) => s.text).join('')).toBe(src)
  })

  it('converts bracket titles and leaves unknown admonition types as info', () => {
    expect(
      convertDocusaurusAdmonitions(':::custom[My title]\nbody\n:::'),
    ).toContain('<Callout type="info" title="My title">')
  })

  it('converts self-contained Asides without altering other components', () => {
    const out = convertStarlightAsides(
      '<Aside type="danger">Danger</Aside>\n<Cards><Card>x</Card></Cards>',
    )
    expect(out).toContain('<Callout type="danger">Danger</Callout>')
    expect(out).toContain('<Cards><Card>x</Card></Cards>')
  })
})
