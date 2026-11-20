import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { migrate } from '../../src/node/migrate'

function tmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bolt-mig-links-'))
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

function docuProject(content: string, versions?: string[]): string {
  const root = tmp()
  write(
    path.join(root, 'package.json'),
    JSON.stringify({ dependencies: { '@docusaurus/core': '^3.10.2' } }),
  )
  write(
    path.join(root, 'docusaurus.config.js'),
    "module.exports = { title: 'X' }",
  )
  write(path.join(root, 'docs', 'page.md'), content)
  if (versions)
    write(path.join(root, 'versions.json'), JSON.stringify(versions))
  return root
}

function starProject(content: string): string {
  const root = tmp()
  write(
    path.join(root, 'package.json'),
    JSON.stringify({
      dependencies: { astro: '^5.0.0', '@astrojs/starlight': '^0.36.0' },
    }),
  )
  write(
    path.join(root, 'astro.config.mjs'),
    "export default { integrations: [starlight({ title: 'X' })] }",
  )
  write(path.join(root, 'src', 'content', 'docs', 'page.md'), content)
  return root
}

describe('Docusaurus link rewriting', () => {
  it('makes version-prefixed links canonical and leaves others intact', () => {
    const root = docuProject(
      [
        '---',
        'title: Links',
        '---',
        '[guide](/docs/next/guide)',
        '[api](/docs/v1/api)',
        '[ref][install]',
        '<a href="/docs/next/other">Other</a>',
        '[external](https://example.com/docs/next/x)',
        '[anchor](#section)',
        '[mail](mailto:a@b.com)',
        '',
        '[install]: /docs/next/install',
      ].join('\n'),
      ['v1'],
    )

    const plan = migrate({ root, apply: false })
    const finding = plan.findings.find(
      (f) => f.id === 'docusaurus/link-version-prefix',
    )
    expect(finding).toBeDefined()
    expect(finding?.action).toBe('fixable')
    expect(read(path.join(root, 'docs', 'page.md'))).toContain(
      '/docs/next/guide',
    )

    migrate({ root, apply: true })
    const out = read(path.join(root, 'docs', 'page.md'))
    expect(out).toContain('[guide](/docs/guide)')
    expect(out).toContain('[api](/docs/api)')
    expect(out).toContain('[ref][install]')
    expect(out).toContain('<a href="/docs/other">Other</a>')
    expect(out).toContain('[install]: /docs/install')
    expect(out).toContain('[external](https://example.com/docs/next/x)')
    expect(out).toContain('[anchor](#section)')
    expect(out).toContain('[mail](mailto:a@b.com)')

    const second = migrate({ root, apply: false })
    expect(second.findings.filter((f) => f.action === 'fixable')).toEqual([])
  })

  it('preserves CRLF and BOM while rewriting links', () => {
    const root = docuProject(
      `\uFEFF---\r\ntitle: Links\r\n---\r\n[go](/docs/next/guide)\r\n`,
    )
    migrate({ root, apply: true })
    const out = bytes(path.join(root, 'docs', 'page.md')).toString('utf-8')
    expect(out.startsWith('\uFEFF')).toBe(true)
    expect(out).toContain('[go](/docs/guide)\r\n')
    expect(out.replace(/\r\n/g, '')).not.toContain('\n')
  })
})

describe('Starlight link reporting', () => {
  it('reports absolute doc-like links without rewriting them', () => {
    const root = starProject(
      [
        '---',
        'title: Links',
        '---',
        '[guide](/guides/install)',
        '[docs](/docs/guides/install)',
        '![logo](/logo.svg)',
        '[external](https://example.com)',
      ].join('\n'),
    )

    // The content is copied to docs/ by --apply, so links can only be
    // inspected once that step has run.
    const plan = migrate({ root, apply: true })
    const reported = plan.findings.filter((f) => f.id === 'starlight/link-base')
    expect(reported).toHaveLength(1)
    expect(reported[0].action).toBe('manual')
    expect(reported[0].snippet).toBe('/guides/install')

    expect(read(path.join(root, 'docs', 'page.md'))).toContain(
      '[guide](/guides/install)',
    )
  })
})
