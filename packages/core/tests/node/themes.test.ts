import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  THEMES_BUILD,
  THEMES_DEFAULT,
  THEMES_SUPPORTED,
} from '../../src/node/mdx/shiki-themes'
import { highlight } from '../../src/node/mdx/highlighter'

const HERE = dirname(fileURLToPath(import.meta.url))
const THEMES = resolve(HERE, '../../src/node/mdx/themes')

function themeFiles(): string[] {
  return readdirSync(THEMES).filter((f) => f.endsWith('.mjs'))
}

/**
 * `@shikijs/themes` carries 66 themes for 1.8 MB; the seven registered below cost
 * 196 KB. These tests exist because the previous setup registered two themes and
 * documented seven, so any of the other five reached Shiki unloaded and threw
 * `Theme '<name>' not found` — a build failure, not a degraded render.
 */
describe('vendored shiki themes', () => {
  it('resolves every theme named in THEMES_SUPPORTED', () => {
    const missing = THEMES_SUPPORTED.filter(
      (name) => !existsSync(join(THEMES, `${name}.mjs`)),
    )

    expect(missing).toEqual([])
  })

  it('registers one theme per supported name, with no unreferenced files', () => {
    expect(THEMES_BUILD).toHaveLength(THEMES_SUPPORTED.length)
    expect(themeFiles().sort()).toEqual(
      [...THEMES_SUPPORTED].map((n) => `${n}.mjs`).sort(),
    )
  })

  it('keeps the vendored set far smaller than the package it replaces', () => {
    // Seven vendored against 66 upstream. A regression that reintroduced the
    // package wholesale would show up here.
    expect(themeFiles().length).toBeLessThanOrEqual(12)
  })

  it('does not import @shikijs/themes', () => {
    const source = readFileSync(
      join(resolve(HERE, '../../src/node/mdx'), 'shiki-themes.ts'),
      'utf8',
    )

    expect(source).not.toMatch(/^\s*import\s.*@shikijs\/themes/m)
  })

  it('loads every supported theme and highlights with it', async () => {
    const h = await highlight({ regexEngine: 'javascript' })
    const loaded = h.getLoadedThemes()

    for (const name of THEMES_SUPPORTED) {
      expect(loaded).toContain(name)
      // The failure this guards threw at build time rather than degrading.
      const html = h.codeToHtml('const x = 1', { lang: 'ts', theme: name })
      expect(html).toContain('<pre')
    }
  })

  it('keeps the default light/dark pair inside the supported set', () => {
    expect(THEMES_SUPPORTED).toContain(THEMES_DEFAULT.light)
    expect(THEMES_SUPPORTED).toContain(THEMES_DEFAULT.dark)
  })
})
