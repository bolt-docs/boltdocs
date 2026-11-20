import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { migrate } from '../../src/node/migrate'
import { generateRoutes } from '../../src/node/routes'
import {
  getRouteCacheContext,
  getRouteGenerationFingerprint,
} from '../../src/node/routes/cache'
import type { BoltdocsConfig } from '../../src/shared/types'

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf-8')
}

function migratedProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bolt-mig-verify-'))
  write(
    path.join(root, 'package.json'),
    JSON.stringify({ dependencies: { '@docusaurus/core': '^3.10.2' } }),
  )
  write(
    path.join(root, 'docusaurus.config.js'),
    [
      'module.exports = {',
      "  title: 'Migrated site',",
      "  tagline: 'After migration',",
      "  url: 'https://example.com',",
      "  i18n: { defaultLocale: 'en', locales: ['en', 'es'] },",
      '}',
    ].join('\n'),
  )
  write(
    path.join(root, 'sidebars.js'),
    [
      'module.exports = {',
      '  docs: [',
      "    { type: 'category', label: 'Getting Started', position: 1, items: [",
      "      { type: 'doc', id: 'intro', label: 'Overview', position: 2 },",
      "      'install',",
      '    ] },',
      '  ],',
      '}',
    ].join('\n'),
  )
  write(
    path.join(root, 'docs', 'intro.md'),
    '---\ntitle: Intro\n---\n:::note Hello\nMigrated\n:::',
  )
  write(
    path.join(root, 'docs', 'install.md'),
    '---\ntitle: Install\n---\nInstall',
  )
  write(
    path.join(root, 'docs', 'guides', '_category_.json'),
    JSON.stringify({ label: 'Guides', position: 3 }),
  )
  write(
    path.join(root, 'docs', 'guides', 'advanced.md'),
    '---\ntitle: Advanced\nsidebar_position: 1\n---\nAdvanced',
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
    path.join(root, 'blog', 'hello.md'),
    "---\ntitle: Hello\nauthors: { name: 'Jesús' }\n---\nPost",
  )
  return root
}

describe('migrated site produces working Boltdocs routes', () => {
  it('generates routes from the rewritten filesystem, frontmatter and meta.json', async () => {
    const root = migratedProject()
    const plan = migrate({ root, apply: true })
    expect(plan.findings.some((f) => f.id === 'docusaurus/sidebars')).toBe(true)

    // The generated config is valid TypeScript (syntax checked elsewhere); use
    // the equivalent in-memory config to exercise the real route generator.
    const config: BoltdocsConfig = {
      theme: { title: 'Migrated site', description: 'After migration' },
      docsDir: 'docs',
      i18n: { defaultLocale: 'en', locales: ['en', 'es'] },
    }
    const routes = await generateRoutes(
      path.join(root, 'docs'),
      config,
      '/docs',
      true,
    )

    expect(routes.length).toBeGreaterThanOrEqual(5)

    const intro = routes.find((r) => r.title === 'Intro' && !r.locale)
    expect(intro).toBeDefined()
    expect(intro?.sidebarPosition).toBe(2)
    // generateRoutes derives the group name from the folder; the human label
    // lives in meta.json and is consumed by the runtime sidebar.
    expect(intro?.groupTitle).toBe('Getting-started')

    const install = routes.find((r) => r.title === 'Install')
    expect(install?.group).toBeDefined()
    expect(install?.groupTitle).toBe('Getting-started')

    const fingerprint = getRouteGenerationFingerprint(config, '/docs')
    const directoryMeta = getRouteCacheContext(
      path.join(root, 'docs'),
    ).variants.get(fingerprint)?.directoryMeta
    expect(directoryMeta?.['getting-started']?.title).toBe('Getting Started')
    expect(directoryMeta?.guides?.order).toBe(3)

    const advanced = routes.find((r) => r.title === 'Advanced')
    expect(advanced?.groupTitle).toBe('Guides')
    // The category position lives in meta.json (`order`) and is applied by the
    // runtime sidebar, not by generateRoutes.
    expect(directoryMeta?.guides?.order).toBe(3)
    expect(advanced?.sidebarPosition).toBe(1)

    const spanish = routes.find(
      (r) => r.locale === 'es' && r.title === 'Intro ES',
    )
    expect(spanish).toBeDefined()

    const post = routes.find((r) => r.title === 'Hello')
    expect(post).toBeDefined()
    expect(post?.collection).toBe('blog')
  }, 30000)
})
