import { describe, it, expect, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { loadConfiguredPlugins } from '../../src/node/security/audit/load-plugins'

const roots: string[] = []

function makeRoot(config: string | null): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-plugins-'))
  roots.push(root)
  if (config !== null) {
    fs.writeFileSync(path.join(root, 'boltdocs.config.mjs'), config)
  }
  return root
}

afterEach(() => {
  for (const r of roots) fs.rmSync(r, { recursive: true, force: true })
  roots.length = 0
})

describe('loadConfiguredPlugins', () => {
  it('extracts plugins from the user config', async () => {
    const root = makeRoot(
      'export default { theme: { title: "X" }, plugins: [{ name: "a" }, { name: "b", boltdocsVersion: ">=2" }] }',
    )
    const { plugins, configFile } = await loadConfiguredPlugins(root)
    expect(plugins).toEqual([
      { name: 'a' },
      { name: 'b', boltdocsVersion: '>=2' },
    ])
    expect(configFile).toBe(path.join(root, 'boltdocs.config.mjs'))
  })

  it('returns an empty list when no plugins are configured', async () => {
    const root = makeRoot('export default { theme: { title: "X" } }')
    const { plugins, configFile } = await loadConfiguredPlugins(root)
    expect(plugins).toEqual([])
    expect(configFile).toBeDefined()
  })

  it('returns an empty list when there is no config file', async () => {
    const root = makeRoot(null)
    const { plugins, configFile } = await loadConfiguredPlugins(root)
    expect(plugins).toEqual([])
    expect(configFile).toBeUndefined()
  })

  it('supports a config object export (module.exports style)', async () => {
    const root = makeRoot('export default { plugins: [{ name: "c" }] }')
    const { plugins } = await loadConfiguredPlugins(root)
    expect(plugins).toEqual([{ name: 'c' }])
  })

  it('throws a descriptive error when all config files are broken', async () => {
    const root = makeRoot('export default { plugins: [')
    await expect(loadConfiguredPlugins(root)).rejects.toThrow(
      /Failed to load Boltdocs configuration/,
    )
  })

  it('falls through to the next config file when the first is broken', async () => {
    const root = makeRoot(null)
    fs.writeFileSync(
      path.join(root, 'boltdocs.config.js'),
      'export default { plugins: [',
    )
    fs.writeFileSync(
      path.join(root, 'boltdocs.config.mjs'),
      'export default { plugins: [{ name: "via-mjs" }] }',
    )
    const { plugins, configFile } = await loadConfiguredPlugins(root)
    expect(plugins).toEqual([{ name: 'via-mjs' }])
    expect(configFile).toBe(path.join(root, 'boltdocs.config.mjs'))
  })

  it('errors when plugins is present but not an array', async () => {
    const root = makeRoot('export default { plugins: "nope" }')
    await expect(loadConfiguredPlugins(root)).rejects.toThrow(
      /plugins must be an array/,
    )
  })

  it('matches plugins to scoped packages via config imports', async () => {
    const root = makeRoot(null)
    const pkgDir = path.join(root, 'node_modules', '@bdocs', 'plugin-mermaid')
    fs.mkdirSync(pkgDir, { recursive: true })
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({
        name: '@bdocs/plugin-mermaid',
        version: '0.4.0',
        main: 'index.js',
      }),
    )
    // CJS so Node can load it regardless of the package "type" field.
    fs.writeFileSync(
      path.join(pkgDir, 'index.js'),
      'module.exports = { name: "dummy" }\n',
    )
    fs.writeFileSync(
      path.join(root, 'boltdocs.config.mjs'),
      [
        "import mermaid from '@bdocs/plugin-mermaid'",
        'export default { plugins: [',
        '  { name: "boltdocs-plugin-mermaid", version: "0.1.0" },',
        '] }',
        '',
      ].join('\n'),
    )
    const { plugins } = await loadConfiguredPlugins(root)
    expect(plugins).toHaveLength(1)
    expect(plugins[0].name).toBe('boltdocs-plugin-mermaid')
    expect(plugins[0].packageName).toBe('@bdocs/plugin-mermaid')
  })

  it('matches a plugin whose name equals the unscoped package segment', async () => {
    const root = makeRoot(null)
    const pkgDir = path.join(
      root,
      'node_modules',
      '@bdocs',
      'plugin-tailwindcss',
    )
    fs.mkdirSync(pkgDir, { recursive: true })
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({
        name: '@bdocs/plugin-tailwindcss',
        version: '1.0.0',
        main: 'index.js',
      }),
    )
    fs.writeFileSync(path.join(pkgDir, 'index.js'), 'module.exports = {} \n')
    fs.writeFileSync(
      path.join(root, 'boltdocs.config.mjs'),
      [
        "import tw from '@bdocs/plugin-tailwindcss'",
        'export default { plugins: [{ name: "plugin-tailwindcss" }] }',
        '',
      ].join('\n'),
    )
    const { plugins } = await loadConfiguredPlugins(root)
    expect(plugins).toHaveLength(1)
    expect(plugins[0].packageName).toBe('@bdocs/plugin-tailwindcss')
  })

  it('leaves plugins without importable packages unmatched', async () => {
    const root = makeRoot(
      'export default { plugins: [{ name: "local-thing" }] }',
    )
    const { plugins } = await loadConfiguredPlugins(root)
    // No imports in the config → no candidates → legacy name resolution.
    expect(plugins).toEqual([{ name: 'local-thing' }])
    expect(plugins[0].packageName).toBeUndefined()
  })
})
