import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { migrate } from '../../src/node/migrate'
import {
  collectStringConstants,
  findUnresolvedConfigValues,
  pickField,
} from '../../src/node/migrate/framework-common'

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

function docusaurusProject(config: string): string {
  const root = tmp('bolt-cfgres-docu-')
  write(
    path.join(root, 'package.json'),
    JSON.stringify({ dependencies: { '@docusaurus/core': '^3.10.2' } }),
  )
  write(path.join(root, 'docusaurus.config.ts'), config)
  write(path.join(root, 'docs', 'intro.md'), '---\ntitle: Intro\n---\nHi')
  return root
}

function starlightProject(config: string): string {
  const root = tmp('bolt-cfgres-star-')
  write(
    path.join(root, 'package.json'),
    JSON.stringify({
      dependencies: { astro: '^5.0.0', '@astrojs/starlight': '^0.36.0' },
    }),
  )
  write(path.join(root, 'astro.config.mjs'), config)
  write(
    path.join(root, 'src', 'content', 'docs', 'intro.md'),
    '---\ntitle: Intro\n---\nHi',
  )
  return root
}

describe('config field helpers', () => {
  it('collects string constants and ignores commented-out ones', () => {
    const constants = collectStringConstants(
      [
        "const REAL = 'Real value'",
        "// const FAKE = 'Fake value'",
        'const NUMERIC = 42',
      ].join('\n'),
    )
    expect(constants.get('REAL')).toBe('Real value')
    expect(constants.has('FAKE')).toBe(false)
    expect(constants.has('NUMERIC')).toBe(false)
  })

  it('resolves identifiers through constants in pickField', () => {
    const source = "const TITLE = 'Docs'\nexport default { title: TITLE }"
    expect(pickField(source, 'title')).toBe('Docs')
  })

  it('separates literals, constants and unresolved expressions', () => {
    const source = [
      'const TITLE = "Constant title"',
      'export default {',
      '  title: TITLE,',
      "  url: 'https://example.com',",
      '  favicon: process.env.FAVICON,',
      '  tagline: siteConfig.tagline,',
      '}',
    ].join('\n')
    expect(
      findUnresolvedConfigValues(source, [
        'title',
        'url',
        'favicon',
        'tagline',
      ]),
    ).toEqual([
      {
        key: 'favicon',
        expression: 'process.env.FAVICON',
        line: 5,
      },
      {
        key: 'tagline',
        expression: 'siteConfig.tagline',
        line: 6,
      },
    ])
  })
})

describe('dynamic config reporting', () => {
  it('resolves Docusaurus constants into the generated config', () => {
    const root = docusaurusProject(
      [
        "const SITE_TITLE = 'My Constant Site'",
        "const SITE_TAGLINE = 'Constant tagline'",
        'module.exports = {',
        '  title: SITE_TITLE,',
        '  tagline: SITE_TAGLINE,',
        '}',
      ].join('\n'),
    )
    const plan = migrate({ root, apply: false })
    expect(
      plan.findings.some((f) => f.id === 'docusaurus/config-unresolved'),
    ).toBe(false)
    migrate({ root, apply: true })
    const config = read(path.join(root, 'boltdocs.config.ts'))
    expect(config).toContain("title: 'My Constant Site'")
    expect(config).toContain("description: 'Constant tagline'")
  })

  it('reports unresolved Docusaurus values with line and snippet', () => {
    const root = docusaurusProject(
      [
        'module.exports = {',
        '  title: process.env.SITE_TITLE,',
        "  url: 'https://example.com',",
        '}',
      ].join('\n'),
    )
    const plan = migrate({ root, apply: false })
    const finding = plan.findings.find(
      (f) => f.id === 'docusaurus/config-unresolved',
    )
    expect(finding).toBeDefined()
    expect(finding?.line).toBe(2)
    expect(finding?.snippet).toBe('process.env.SITE_TITLE')
    expect(finding?.action).toBe('manual')

    migrate({ root, apply: true })
    // The generated config is still valid; the unresolved field is simply
    // absent rather than invented.
    expect(read(path.join(root, 'boltdocs.config.ts'))).toContain(
      'export default defineConfig({',
    )
    expect(read(path.join(root, 'boltdocs.config.ts'))).not.toContain(
      'process.env',
    )
  })

  it('resolves Starlight constants and reports env-based values', () => {
    const root = starlightProject(
      [
        "const TITLE = 'Handbook'",
        'export default {',
        '  integrations: [starlight({',
        '    title: TITLE,',
        '    description: process.env.DESCRIPTION,',
        '  })],',
        '}',
      ].join('\n'),
    )
    const plan = migrate({ root, apply: false })
    const unresolved = plan.findings.filter(
      (f) => f.id === 'starlight/config-unresolved',
    )
    expect(unresolved).toHaveLength(1)
    expect(unresolved[0].snippet).toBe('process.env.DESCRIPTION')

    migrate({ root, apply: true })
    const config = read(path.join(root, 'boltdocs.config.ts'))
    expect(config).toContain("title: 'Handbook'")
    expect(config).not.toContain('process.env')
  })

  it('does not treat spreads or function calls as resolved values', () => {
    const source = 'export default { title: makeTitle(), ...shared }'
    const unresolved = findUnresolvedConfigValues(source, ['title'])
    expect(unresolved).toHaveLength(1)
    expect(unresolved[0].expression).toBe('makeTitle()')
  })
})
