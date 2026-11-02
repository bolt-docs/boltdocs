// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { highlight, ensureLanguage } from '../../src/node/mdx/highlighter'

/**
 * Both regex engines, through the same public API.
 *
 * `ts` used to be reachable here without `ensureLanguage` because it was
 * registered eagerly. It no longer is, so this file is also the check that the
 * on-demand path yields identical highlighting on both engines — the property
 * that made moving the eager set safe.
 */
describe('ambos motores tras el cambio de imports', () => {
  for (const regexEngine of ['javascript', 'oniguruma'] as const) {
    it(`resalta ts con el motor ${regexEngine}`, async () => {
      // Loading first is now required, and that is the contract: a grammar
      // is registered on demand rather than at startup.
      expect(await ensureLanguage('ts', regexEngine)).toBe(true)
      const h = await highlight({ regexEngine })
      const html = h.codeToHtml('const x: number = 1', {
        lang: 'ts',
        theme: 'github-dark',
      })
      expect(html).toContain('<pre')
      expect(html).toMatch(/<span style="color:#[0-9A-Fa-f]{6}">/)
    }, 30_000)

    it(`carga una lengua lazy (yaml) con el motor ${regexEngine}`, async () => {
      expect(await ensureLanguage('yaml', regexEngine)).toBe(true)
      const h = await highlight({ regexEngine })
      const html = h.codeToHtml('a: 1', { lang: 'yaml', theme: 'github-dark' })
      expect(html).toContain('<pre')
    }, 30_000)

    it(`rechaza una lengua no vendorizada con el motor ${regexEngine}`, async () => {
      expect(await ensureLanguage('haskell', regexEngine)).toBe(false)
    })
  }
})
