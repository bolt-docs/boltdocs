// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { highlight, ensureLanguage } from '../../src/node/mdx/highlighter'
import { COMMON_LANGS, LAZY_LANG_IMPORTS } from '@bdocs/grammars'

/**
 * The grammar data moved to `@bdocs/grammars`, and the eager set stayed as it
 * was. Both facts have to hold together: a grammar that cannot be reached at
 * all renders as an unhighlighted block, which is silent — the page still
 * builds, the code block is just suddenly grey.
 *
 * The eager set is not an oversight. Emptying it saves 202 ms of highlighter
 * construction per worker and costs 57% of total build time, measured across
 * three cold builds; see the note on `COMMON_LANGS`. The tests below pin both
 * halves so neither half can move alone again.
 */
describe('grammar loading after the @bdocs/grammars split', () => {
  it('registers the common set eagerly', async () => {
    const h = await highlight({ regexEngine: 'javascript' })
    const loaded = h.getLoadedLanguages()

    // Eager registration is what makes a documentation build 57% faster than
    // the all-lazy alternative; see the note on COMMON_LANGS before changing it.
    expect(COMMON_LANGS.length).toBe(10)
    for (const lang of ['html', 'js', 'ts', 'tsx', 'css', 'bash', 'json']) {
      expect(loaded, `${lang} should be eager`).toContain(lang)
    }
  })

  it('keeps the eager set out of the lazy map', async () => {
    // A grammar in both lists is loaded twice on the rare path where the
    // eager registration missed it. Not a bug, but it means the two lists
    // have drifted and one of them is no longer the source of truth.
    for (const grammar of COMMON_LANGS) {
      const name = (grammar as { name?: string }).name
      if (name) {
        expect(Object.keys(LAZY_LANG_IMPORTS)).not.toContain(name)
      }
    }
  }, 10_000)

  it('loads a lazy language on demand', async () => {
    // `rust` is in LAZY_LANG_IMPORTS, not COMMON_LANGS: loading it proves the
    // dynamic import still resolves to a real file after the move.
    const h = await highlight({ regexEngine: 'javascript' })
    expect(h.getLoadedLanguages()).not.toContain('rust')
    const ok = await ensureLanguage('rust', 'javascript')

    expect(ok).toBe(true)
    expect(h.getLoadedLanguages()).toContain('rust')
  }, 30_000)

  it('loads a grammar only once for concurrent blocks', async () => {
    const h = await highlight({ regexEngine: 'javascript' })

    // Two blocks of the same language in one page: the second must reuse the
    // first's load rather than importing and registering the grammar again.
    await Promise.all([
      ensureLanguage('swift', 'javascript'),
      ensureLanguage('swift', 'javascript'),
    ])

    expect(h.getLoadedLanguages().filter((l) => l === 'swift')).toHaveLength(1)
  }, 30_000)

  it('loads a grammar that pulls in its siblings', async () => {
    // `cpp` imports cpp-macro, glsl, sql and regexp — the case where a
    // partial copy would fail with an unresolved import rather than a
    // missing file.
    //
    // The generous timeout is not slack for a slow machine: `cpp.mjs` is
    // 393 KB and pulling its four siblings in compiles roughly 600 KB of
    // TextMate patterns, which competes with every other suite's
    // initialization for the same cores.
    const ok = await ensureLanguage('cpp', 'javascript')
    expect(ok).toBe(true)

    const html = await (
      await highlight({ regexEngine: 'javascript' })
    ).codeToHtml('int main() { return 0; }', {
      lang: 'cpp',
      theme: 'github-dark',
    })
    expect(html).toContain('<pre')
    expect(html).toContain('color:')
  }, 30_000)

  it('resolves an alias to its canonical grammar', async () => {
    expect(await ensureLanguage('typescript', 'javascript')).toBe(true)
    expect(await ensureLanguage('yml', 'javascript')).toBe(true)
  })

  it('needs no grammar for plaintext-like languages', async () => {
    // `plaintext` is the id the degraded path would send an engine. It must
    // never be looked up in the map, which has no entry for it.
    for (const lang of ['text', 'plaintext', 'txt', 'plain', 'none']) {
      expect(await ensureLanguage(lang, 'javascript')).toBe(true)
    }
    expect(Object.keys(LAZY_LANG_IMPORTS)).not.toContain('plaintext')
  })

  it('reports an unknown language instead of throwing', async () => {
    expect(await ensureLanguage('not-a-language', 'javascript')).toBe(false)
  })
})
