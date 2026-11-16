import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { migrate } from '../../src/node/migrate'

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bolt-mig-docdir-'))
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf-8')
}

function read(file: string): string {
  return fs.readFileSync(file, 'utf-8')
}

function project(config: string, contentDir: string): string {
  const root = tmp()
  write(
    path.join(root, 'package.json'),
    JSON.stringify({ dependencies: { '@docusaurus/core': '^3.10.2' } }),
  )
  write(path.join(root, 'docusaurus.config.js'), config)
  write(
    path.join(root, contentDir, 'intro.md'),
    '---\ntitle: Intro\nsidebar_position: 1\n---\n:::note Hi\nthere\n:::',
  )
  write(
    path.join(root, contentDir, 'install.md'),
    '---\ntitle: Install\n---\nInstall',
  )
  write(
    path.join(root, 'sidebars.js'),
    [
      'module.exports = {',
      '  docs: [',
      "    { type: 'category', label: 'Start Here', items: ['install'] },",
      '  ],',
      '}',
    ].join('\n'),
  )
  return root
}

describe('custom docsDir migration', () => {
  it('migrates content and sidebars under a plugin-configured docs path', () => {
    const root = project(
      [
        'module.exports = {',
        "  title: 'Custom',",
        '  plugins: [',
        "    ['@docusaurus/plugin-content-docs', { path: 'documentation' }],",
        '  ],',
        '}',
      ].join('\n'),
      'documentation',
    )

    const plan = migrate({ root, apply: false })
    expect(plan.findings.some((f) => f.id === 'docusaurus/sidebars')).toBe(true)

    migrate({ root, apply: true })

    const config = read(path.join(root, 'boltdocs.config.ts'))
    expect(config).toContain("docsDir: 'documentation'")
    expect(config).toContain("title: 'Custom'")
    expect(read(path.join(root, 'documentation', 'intro.md'))).toContain(
      'sidebarPosition: 1',
    )
    expect(read(path.join(root, 'documentation', 'intro.md'))).toContain(
      '<Callout type="info" title="Hi">',
    )
    expect(
      read(path.join(root, 'documentation', 'start-here', 'install.md')),
    ).toContain('title: Install')
    expect(fs.existsSync(path.join(root, 'docs'))).toBe(false)
    expect(
      JSON.parse(
        read(path.join(root, 'documentation', 'start-here', 'meta.json')),
      ).title,
    ).toBe('Start Here')
  })

  it('reads the path from a classic preset docs option', () => {
    const root = project(
      [
        'module.exports = {',
        '  presets: [',
        "    ['classic', { docs: { path: 'manual' } }],",
        '  ],',
        '}',
      ].join('\n'),
      'manual',
    )
    migrate({ root, apply: true })
    expect(read(path.join(root, 'boltdocs.config.ts'))).toContain(
      "docsDir: 'manual'",
    )
    expect(read(path.join(root, 'manual', 'intro.md'))).toContain(
      '<Callout type="info" title="Hi">',
    )
  })

  it('normalizes ./ and trailing slashes', () => {
    const root = project(
      "module.exports = { plugins: [['@docusaurus/plugin-content-docs', { path: './guides/' }]] }",
      'guides',
    )
    migrate({ root, apply: true })
    expect(read(path.join(root, 'boltdocs.config.ts'))).toContain(
      "docsDir: 'guides'",
    )
  })

  it('omits docsDir from the generated config when it is the default', () => {
    const root = project("module.exports = { title: 'Default' }", 'docs')
    migrate({ root, apply: true })
    const config = read(path.join(root, 'boltdocs.config.ts'))
    expect(config).not.toContain('docsDir:')
  })
})
