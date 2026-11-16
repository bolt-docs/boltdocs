import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { migrate } from '../../src/node/migrate'
import { LiteralParser } from '../../src/node/migrate/framework-sidebars'

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

function exists(file: string): boolean {
  return fs.existsSync(file)
}

function setup(
  sidebars: string,
  docs: Record<string, string> = {
    'intro.md': '---\nid: intro\ntitle: Intro\n---\nWelcome',
    'install.md': '---\ntitle: Install\n---\nInstall',
  },
  configName = 'docusaurus.config.js',
): string {
  const root = tmp('bolt-rob-sidebar-')
  write(
    path.join(root, 'package.json'),
    JSON.stringify({
      name: 'site',
      dependencies: { '@docusaurus/core': '^3.10.2' },
    }),
  )
  write(path.join(root, configName), "module.exports = { title: 'Site' }")
  write(path.join(root, 'sidebars.js'), sidebars)
  for (const [name, content] of Object.entries(docs)) {
    write(path.join(root, 'docs', name), content)
  }
  return root
}

const SIDEBARS = [
  'const sidebars = {',
  '  tutorialSidebar: [',
  "    'intro',",
  '    {',
  "      type: 'category',",
  "      label: 'Getting Started',",
  '      position: 1,',
  '      collapsed: false,',
  '      items: [',
  "        { type: 'doc', id: 'install', label: 'Installation', position: 2 },",
  '      ],',
  '    },',
  '  ],',
  '}',
  'module.exports = sidebars',
].join('\n')

describe('sidebar literal parser', () => {
  it('parses strings, numbers, objects, arrays and comments', () => {
    const parsed = new LiteralParser(
      [
        '{',
        "  // title: 'ignored'",
        "  name: 'Docs',",
        '  position: 3,',
        '  collapsed: false,',
        "  items: ['a', { type: 'doc', id: 'b', position: 2 }],",
        '}',
      ].join('\n'),
    ).parse() as Record<string, unknown>
    expect(parsed.name).toBe('Docs')
    expect(parsed.position).toBe(3)
    expect(parsed.collapsed).toBe(false)
    expect(parsed.items).toHaveLength(2)
  })

  it('marks spreads and calls as unknown instead of guessing', () => {
    const parsed = new LiteralParser(
      "{ items: [...shared, makeDoc('x')] }",
    ).parse() as Record<string, unknown[]>
    expect(parsed.items).toHaveLength(2)
    expect(parsed.items[0]).toHaveProperty('__unknown', true)
    expect(parsed.items[1]).toHaveProperty('__unknown', true)
  })
})

describe('Docusaurus sidebar migration', () => {
  it('maps categories, positions and labels into folders/meta/frontmatter', () => {
    const root = setup(SIDEBARS)
    const plan = migrate({ root, apply: false })
    expect(plan.findings.some((f) => f.id === 'docusaurus/sidebars')).toBe(true)
    expect(
      exists(path.join(root, 'docs', 'getting-started', 'install.md')),
    ).toBe(false)

    migrate({ root, apply: true })

    const intro = read(path.join(root, 'docs', 'intro.md'))
    const install = read(
      path.join(root, 'docs', 'getting-started', 'install.md'),
    )
    expect(intro).toContain('id: intro')
    expect(install).toContain('sidebarPosition: 2')
    expect(install).toContain('sidebarLabel: "Installation"')
    expect(exists(path.join(root, 'docs', 'install.md'))).toBe(false)

    const meta = JSON.parse(
      read(path.join(root, 'docs', 'getting-started', 'meta.json')),
    )
    expect(meta.title).toBe('Getting Started')
    expect(meta.order).toBe(1)
    expect(meta.collapsed).toBe(false)
  })

  it('handles nested categories and ESM default exports', () => {
    const root = setup(
      [
        'export default {',
        '  docs: [',
        '    {',
        "      type: 'category',",
        "      label: 'API',",
        '      items: [',
        '        {',
        "          type: 'category',",
        "          label: 'Hooks',",
        '          position: 2,',
        "          items: [{ type: 'doc', id: 'intro' }],",
        '        },',
        '      ],',
        '    },',
        '  ],',
        '}',
      ].join('\n'),
    )
    migrate({ root, apply: true })
    expect(exists(path.join(root, 'docs', 'api', 'hooks', 'intro.md'))).toBe(
      true,
    )
    expect(
      JSON.parse(read(path.join(root, 'docs', 'api', 'hooks', 'meta.json')))
        .order,
    ).toBe(2)
  })

  it('respects frontmatter ids and ignores commented-out entries', () => {
    const root = setup(
      [
        'const sidebars = {',
        '  docs: [',
        "    // 'missing-doc',",
        "    { type: 'doc', id: 'guide', label: 'Guide' },",
        '  ],',
        '}',
      ].join('\n'),
      {
        'some-path.md': '---\nid: guide\ntitle: Guide\n---\nContent',
      },
    )
    migrate({ root, apply: true })
    expect(exists(path.join(root, 'docs', 'some-path.md'))).toBe(true)
    expect(read(path.join(root, 'docs', 'some-path.md'))).toContain(
      'sidebarLabel: "Guide"',
    )
    expect(fs.existsSync(path.join(root, 'docs', 'missing-doc.md'))).toBe(false)
  })

  it('reports autogenerated, external links and unknown docs as manual/info', () => {
    const root = setup(
      [
        'const sidebars = {',
        '  docs: [',
        "    { type: 'autogenerated', dirName: 'reference', label: 'Reference' },",
        "    { type: 'link', href: 'https://example.com', label: 'Web' },",
        "    { type: 'doc', id: 'does-not-exist' },",
        '  ],',
        '}',
      ].join('\n'),
    )
    const plan = migrate({ root, apply: false })
    const ids = plan.findings.map((f) => f.id)
    expect(ids).toContain('docusaurus/sidebars-autogenerated')
    expect(ids).toContain('docusaurus/sidebars-external')
    expect(ids).toContain('docusaurus/sidebars-missing-doc')
  })

  it('reports unparseable sidebar definitions without writing', () => {
    const root = setup('const sidebars = buildSidebars(themeConfig)')
    const plan = migrate({ root, apply: false })
    expect(
      plan.findings.some((f) => f.id === 'docusaurus/sidebars-unparsed'),
    ).toBe(true)
    migrate({ root, apply: true })
    expect(exists(path.join(root, 'docs', 'intro.md'))).toBe(true)
  })

  it('is idempotent and never writes on a dry run', () => {
    const root = setup(SIDEBARS)
    const dry = migrate({ root, apply: false })
    expect(dry.applied).toEqual([])
    expect(
      exists(path.join(root, 'docs', 'getting-started', 'install.md')),
    ).toBe(false)

    migrate({ root, apply: true })
    const before = read(
      path.join(root, 'docs', 'getting-started', 'install.md'),
    )
    const second = migrate({ root, apply: false })
    expect(second.findings.filter((f) => f.action === 'fixable')).toEqual([])
    migrate({ root, apply: true })
    expect(read(path.join(root, 'docs', 'getting-started', 'install.md'))).toBe(
      before,
    )
  })

  it('writes valid meta.json and keeps existing meta fields', () => {
    const root = setup(SIDEBARS)
    write(
      path.join(root, 'docs', 'getting-started', 'meta.json'),
      JSON.stringify({ icon: 'book', order: 9 }),
    )
    migrate({ root, apply: true })
    const meta = JSON.parse(
      read(path.join(root, 'docs', 'getting-started', 'meta.json')),
    )
    expect(meta.icon).toBe('book')
    expect(meta.title).toBe('Getting Started')
    expect(meta.order).toBe(1)
  })
})
