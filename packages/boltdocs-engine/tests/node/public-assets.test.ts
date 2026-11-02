import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  createPublicAssetResolver,
  rewriteHtmlPublicAssetUrls,
} from '../../src/node/public-assets'

describe('public-assets', () => {
  let tmp: string
  let publicDir: string

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-public-assets-'))
    publicDir = path.join(tmp, 'public')
    fs.mkdirSync(publicDir)
    fs.writeFileSync(path.join(publicDir, 'logo.png'), 'x')
    fs.mkdirSync(path.join(publicDir, 'blog-covers'))
    fs.writeFileSync(path.join(publicDir, 'blog-covers', 'cover.webp'), 'x')
  })

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
  })

  function rewrite(html: string, base = '/docs'): string {
    const resolver = createPublicAssetResolver(publicDir, base)
    return rewriteHtmlPublicAssetUrls(html, resolver)
  }

  describe('createPublicAssetResolver', () => {
    it('resolves existing public files to base-prefixed URLs', () => {
      const resolver = createPublicAssetResolver(publicDir, '/docs')
      expect(resolver.resolve('/logo.png')).toBe('/docs/logo.png')
      expect(resolver.resolve('/blog-covers/cover.webp')).toBe(
        '/docs/blog-covers/cover.webp',
      )
    })

    it('returns null for non-public, prefixed, and traversal paths', () => {
      const resolver = createPublicAssetResolver(publicDir, '/docs')
      expect(resolver.resolve('/not-here.png')).toBeNull()
      expect(resolver.resolve('/blog-covers/missing.webp')).toBeNull()
      // Already base-prefixed — leave it alone.
      expect(resolver.resolve('/docs/logo.png')).toBeNull()
      // Path traversal must never resolve.
      expect(resolver.resolve('/logo.png/../../etc/passwd')).toBeNull()
    })

    it('resolves percent-encoded paths against real fs entries', () => {
      fs.mkdirSync(path.join(publicDir, 'my folder'))
      fs.writeFileSync(path.join(publicDir, 'my folder', 'a.png'), 'x')
      const resolver = createPublicAssetResolver(publicDir, '/docs')
      expect(resolver.resolve('/my%20folder/a.png')).toBe(
        '/docs/my%20folder/a.png',
      )
    })

    it('never rewrites without a base or a public dir', () => {
      expect(
        createPublicAssetResolver(publicDir, undefined).resolve('/logo.png'),
      ).toBeNull()
      expect(
        createPublicAssetResolver(false, '/docs').resolve('/logo.png'),
      ).toBeNull()
      expect(
        createPublicAssetResolver(publicDir, undefined).mightRewrite?.(
          'src="/logo.png"',
        ),
      ).toBe(false)
      expect(
        createPublicAssetResolver(false, '/docs').mightRewrite?.(
          'src="/logo.png"',
        ),
      ).toBe(false)
    })
  })

  describe('resolver gate (mightRewrite)', () => {
    it('is true only when a quoted attribute references a public top-level entry', () => {
      const { mightRewrite } = createPublicAssetResolver(publicDir, '/docs')
      expect(mightRewrite).toBeTypeOf('function')

      expect(mightRewrite?.('<p>plain text, no attrs</p>')).toBe(false)
      // Admitted false positive (documented on the gate): the unanchored
      // pattern cannot tell a prefixed URL from a bare one, so this trips —
      // harmless, the passes leave prefixed URLs untouched (proven below).
      expect(mightRewrite?.('src="/docs/logo.png"')).toBe(true)
      // Non-attribute occurrence of the name must not trip the gate.
      expect(mightRewrite?.('<a href="/other">/logo.png</a>')).toBe(false)
      // A longer first segment that merely starts with a public name.
      expect(mightRewrite?.('href="/logo.pngx"')).toBe(false)
      // Absolute path into a non-public directory.
      expect(mightRewrite?.('src="/unknown/thing.png"')).toBe(false)

      expect(mightRewrite?.('href="/logo.png"')).toBe(true)
      // HTML attribute names are case-insensitive.
      expect(mightRewrite?.('SRC="/logo.png"')).toBe(true)
      expect(mightRewrite?.('poster="/blog-covers/cover.webp"')).toBe(true)
      // srcset: any candidate being public is enough.
      expect(
        mightRewrite?.('srcset="/blog-covers/cover.webp 2x, /nope.webp 1x"'),
      ).toBe(true)
    })

    it('trips on percent-encoded public dir names', () => {
      fs.mkdirSync(path.join(publicDir, 'my folder'))
      fs.writeFileSync(path.join(publicDir, 'my folder', 'a.png'), 'x')
      const { mightRewrite } = createPublicAssetResolver(publicDir, '/docs')
      expect(mightRewrite?.('src="/my%20folder/a.png"')).toBe(true)
      expect(mightRewrite?.('src="/my folder/a.png"')).toBe(true)
    })

    it('escapes regex metacharacters in public dir names', () => {
      fs.mkdirSync(path.join(publicDir, 'v1.0 (beta)'))
      fs.writeFileSync(path.join(publicDir, 'v1.0 (beta)', 'a.png'), 'x')
      const { mightRewrite } = createPublicAssetResolver(publicDir, '/docs')
      expect(mightRewrite?.('src="/v1.0 (beta)/a.png"')).toBe(true)
      expect(mightRewrite?.('src="/v1X0 (beta)/a.png"')).toBe(false)
    })
  })

  describe('rewriteHtmlPublicAssetUrls', () => {
    it('rewrites src/href/poster/content attributes', () => {
      const html =
        '<img src="/logo.png"><a href="/logo.png">x</a>' +
        '<video poster="/logo.png"></video><meta content="/logo.png">'
      expect(rewrite(html)).toBe(html.replaceAll('/logo.png', '/docs/logo.png'))
    })

    it('leaves non-public and prefixed URLs untouched', () => {
      const html = '<img src="/not-here.png"><a href="/docs/logo.png">x</a>'
      expect(rewrite(html)).toBe(html)
    })

    it('rewrites srcset lists, keeping descriptors and non-public candidates', () => {
      const html = '<img srcset="/nope.webp 1x, /blog-covers/cover.webp 2x">'
      expect(rewrite(html)).toBe(
        '<img srcset="/nope.webp 1x, /docs/blog-covers/cover.webp 2x">',
      )
    })

    it('treats data-srcset as a list (legacy two-pass parity)', () => {
      // The old SRCSET_RE matched inside `data-srcset` and handled it as a
      // list; the fused scan reproduces that exactly.
      expect(
        rewrite(
          '<img data-srcset="/nope.webp 1x, /blog-covers/cover.webp 2x">',
        ),
      ).toBe(
        '<img data-srcset="/nope.webp 1x, /docs/blog-covers/cover.webp 2x">',
      )
    })

    it('rewrites percent-encoded URLs', () => {
      fs.mkdirSync(path.join(publicDir, 'my folder'))
      fs.writeFileSync(path.join(publicDir, 'my folder', 'a.png'), 'x')
      expect(rewrite('<img src="/my%20folder/a.png">')).toBe(
        '<img src="/docs/my%20folder/a.png">',
      )
    })

    it('skips both passes when the gate finds no candidate (identity)', () => {
      const html = '<a href="/docs/logo.png">plain</a><p>text</p>'
      expect(rewrite(html)).toBe(html)
    })

    it('still works with hand-built resolvers without a gate', () => {
      const resolver = {
        resolve: (p: string) => (p === '/logo.png' ? '/docs/logo.png' : null),
      }
      expect(
        rewriteHtmlPublicAssetUrls('<img src="/logo.png">', resolver),
      ).toBe('<img src="/docs/logo.png">')
      expect(
        rewriteHtmlPublicAssetUrls('<img src="/other.png">', resolver),
      ).toBe('<img src="/other.png">')
    })

    it('stays correct across repeated calls (shared regex hygiene)', () => {
      expect(rewrite('<img src="/logo.png">')).toContain('/docs/logo.png')
      expect(rewrite('<p>no assets</p>')).toBe('<p>no assets</p>')
      expect(rewrite('<a href="/logo.png">')).toContain('/docs/logo.png')
    })

    it('is a no-op without a base', () => {
      const html = '<img src="/logo.png">'
      const resolver = createPublicAssetResolver(publicDir, undefined)
      expect(rewriteHtmlPublicAssetUrls(html, resolver)).toBe(html)
    })
  })
})
