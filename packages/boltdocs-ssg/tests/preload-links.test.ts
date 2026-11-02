import { describe, it, expect } from 'vitest'
import {
  renderPreloadLinks,
  renderPreloadLinksString,
} from '../src/node/preload-links'

// Minimal Document stub that records appended <link> nodes.
function makeDocument() {
  const headChildren: Array<{ attrs: Array<[string, string]> }> = []
  const document: any = {
    head: {
      querySelector: () => null,
      appendChild: (node: any) => {
        headChildren.push(node)
      },
    },
    createElement: () => ({
      attrs: [] as Array<[string, string]>,
      setAttribute(name: string, value: string) {
        this.attrs.push([name, value])
      },
    }),
  }
  return { document, headChildren }
}

describe('preload-links string renderer', () => {
  it('emits modulepreload for js assets', () => {
    const out = renderPreloadLinksString(new Set(['/assets/app.js']))
    expect(out).toContain('rel="modulepreload"')
    expect(out).toContain('href="/assets/app.js"')
  })

  it('emits stylesheet for css assets', () => {
    const out = renderPreloadLinksString(new Set(['/assets/styles.css']))
    expect(out).toContain('rel="stylesheet"')
  })

  it('emits font preload for woff/woff2/ttf', () => {
    for (const font of ['/f.woff', '/f.woff2', '/f.ttf']) {
      const out = renderPreloadLinksString(new Set([font]))
      expect(out).toContain('rel="preload"')
      expect(out).toContain('as="font"')
    }
  })

  it('emits image preload for png/jpg/jpeg/webp/gif/ico/svg', () => {
    for (const ext of ['png', 'jpg', 'jpeg', 'webp', 'gif', 'ico', 'svg']) {
      const out = renderPreloadLinksString(new Set([`/img.${ext}`]))
      expect(out).toContain('rel="preload"')
      expect(out).toContain('as="image"')
    }
  })

  it('skips unknown asset types', () => {
    expect(renderPreloadLinksString(new Set(['/data.txt']))).toBe('')
  })

  it('does not duplicate identical assets', () => {
    const out = renderPreloadLinksString(new Set(['/a.js', '/a.js']))
    expect(out.match(/modulepreload/g)).toHaveLength(1)
  })
})

describe('preload-links DOM renderer', () => {
  it('appends a link element for js assets', () => {
    const { document, headChildren } = makeDocument()
    renderPreloadLinks(document, new Set(['/app.js']))
    expect(headChildren).toHaveLength(1)
    const attrs = Object.fromEntries(headChildren[0].attrs)
    expect(attrs.rel).toBe('modulepreload')
    expect(attrs.href).toBe('/app.js')
  })

  it('keeps the head empty for unknown assets', () => {
    const { document, headChildren } = makeDocument()
    renderPreloadLinks(document, new Set(['/notes.txt']))
    expect(headChildren).toHaveLength(0)
  })
})
