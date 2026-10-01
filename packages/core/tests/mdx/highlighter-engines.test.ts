import { describe, expect, it } from 'vitest'
import { highlight, ensureLanguage } from '../../src/node/mdx/highlighter'

describe('ambos motores tras el cambio de imports', () => {
  for (const regexEngine of ['javascript', 'oniguruma'] as const) {
    it(`resalta ts con el motor ${regexEngine}`, async () => {
      const h = await highlight({ regexEngine })
      const html = h.codeToHtml('const x: number = 1', {
        lang: 'ts',
        theme: 'github-dark',
      })
      expect(html).toContain('<pre')
      expect(html).toMatch(/<span style="color:#[0-9A-Fa-f]{6}">/)
    })

    it(`carga una lengua lazy (yaml) con el motor ${regexEngine}`, async () => {
      expect(await ensureLanguage('yaml', regexEngine)).toBe(true)
      const h = await highlight({ regexEngine })
      const html = h.codeToHtml('a: 1', { lang: 'yaml', theme: 'github-dark' })
      expect(html).toContain('<pre')
    })

    it(`rechaza una lengua no vendorizada con el motor ${regexEngine}`, async () => {
      expect(await ensureLanguage('haskell', regexEngine)).toBe(false)
    })
  }
})
