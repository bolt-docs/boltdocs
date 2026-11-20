import { afterEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { migrateAction } from '../../src/node/cli/migrate'
import { disableFsPatch } from '../../src/node/security/fs-patch'

function tmp(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix))
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf-8')
}

function project(kind: 'docusaurus' | 'starlight'): string {
  const root = tmp(`bolt-mig-cli-${kind}-`)
  if (kind === 'docusaurus') {
    write(
      path.join(root, 'package.json'),
      JSON.stringify({ dependencies: { '@docusaurus/core': '^3.10.2' } }),
    )
    write(
      path.join(root, 'docusaurus.config.js'),
      "module.exports = { title: 'CLI Site' }",
    )
    write(path.join(root, 'docs', 'intro.md'), '---\ntitle: Intro\n---\nHi')
  } else {
    write(
      path.join(root, 'package.json'),
      JSON.stringify({
        dependencies: { astro: '^5.0.0', '@astrojs/starlight': '^0.36.0' },
      }),
    )
    write(
      path.join(root, 'astro.config.mjs'),
      "export default { integrations: [starlight({ title: 'CLI Star' })] }",
    )
    write(
      path.join(root, 'src', 'content', 'docs', 'intro.md'),
      '---\ntitle: Intro\n---\nHi',
    )
  }
  return root
}

describe('migrateAction (CLI)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    process.exitCode = 0
    disableFsPatch()
  })

  it('rejects an unknown --from value with a clear error and exit code 1', async () => {
    const root = project('docusaurus')
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await migrateAction(root, { from: 'wordpress' })

    expect(errors).toHaveBeenCalledWith(
      expect.stringContaining("Unknown migration source 'wordpress'"),
    )
    expect(process.exitCode).toBe(1)
    expect(fs.existsSync(path.join(root, 'boltdocs.config.ts'))).toBe(false)
  })

  it('runs a Docusaurus migration through the CLI action', async () => {
    const root = project('docusaurus')
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await migrateAction(root, { from: 'docusaurus', apply: true })

    expect(fs.existsSync(path.join(root, 'boltdocs.config.ts'))).toBe(true)
    expect(
      fs.readFileSync(path.join(root, 'boltdocs.config.ts'), 'utf-8'),
    ).toContain("title: 'CLI Site'")
    expect(process.exitCode ?? 0).toBe(0)
  })

  it('autodetects Starlight through the CLI action', async () => {
    const root = project('starlight')
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await migrateAction(root, { apply: true })

    expect(fs.existsSync(path.join(root, 'boltdocs.config.ts'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'docs', 'intro.md'))).toBe(true)
  })

  it('uses exit code 1 for blocking findings in a dry run', async () => {
    const root = project('docusaurus')
    vi.spyOn(console, 'log').mockImplementation(() => {})

    await migrateAction(root, { from: 'docusaurus' })

    expect(process.exitCode).toBe(1)
  })
})
