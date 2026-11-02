import { describe, expect, it } from 'vitest'
import { createHtmlTemplate, renderHTML } from '../src/node/html'

describe('compiled HTML template', () => {
  const indexHTML =
    '<!doctype html>\n<html><head><title>Docs</title></head><body><div id="root"></div></body></html>'
  const options = {
    rootContainerId: 'root',
    appHTML: '<main><h1>Hello</h1></main>',
    metaAttributes: ['<meta name="description" content="Docs">'],
    bodyAttributes: 'class="docs"',
    htmlAttributes: 'lang="en"',
    initialState: null,
  }

  it('matches the existing fast renderer byte-for-byte', async () => {
    const template = createHtmlTemplate({
      rootContainerId: options.rootContainerId,
      indexHTML,
    })

    expect(template).not.toBeNull()
    const compiled = template!(options)
    const existing = await renderHTML({ indexHTML, ...options })

    expect(compiled).toBe(existing)
  })

  it('replaces existing html and body attributes without duplicates', async () => {
    const html = await renderHTML({
      indexHTML:
        '<!doctype html><html lang="en"><head></head><body dir="ltr"><div id="root"></div></body></html>',
      rootContainerId: 'root',
      appHTML: '<main />',
      metaAttributes: [],
      htmlAttributes: 'lang="es" dir="rtl"',
      bodyAttributes: '',
      initialState: null,
    })

    expect(html).toContain('<html lang="es" dir="rtl">')
    expect(html).not.toContain('<html lang="en"')
    expect(html).toContain('<body dir="ltr">')
    expect((html.match(/\blang=/g) || []).length).toBe(1)
  })

  it('returns null for templates that require parser fallback', () => {
    const template = createHtmlTemplate({
      rootContainerId: 'root',
      indexHTML:
        '<html><head></head><body><div id="root" class="custom"></div></body></html>',
    })

    expect(template).toBeNull()
  })
})
