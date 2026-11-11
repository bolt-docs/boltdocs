import { describe, it, expect } from 'vitest'
import { HighlightAdapter } from '../src/adapter.js'

describe('HighlightAdapter (Prism)', () => {
  it('implements CodeHighlighterAdapter interface', () => {
    const adapter = new HighlightAdapter()
    expect(adapter.name).toBe('highlight')
    expect(typeof adapter.getOptions).toBe('function')
    expect(typeof adapter.initialize).toBe('function')
    expect(typeof adapter.ensureLanguage).toBe('function')
    expect(typeof adapter.renderPlaintext).toBe('function')
    expect(typeof adapter.prewarm).toBe('function')
  })

  it('initializes and returns a runtime', async () => {
    const adapter = new HighlightAdapter()
    const runtime = await adapter.initialize()
    expect(typeof runtime.codeToHast).toBe('function')
    expect(typeof runtime.codeToHtml).toBe('function')
  })

  it('renders JavaScript to HTML with Prism tokens and bd-token classes', async () => {
    const adapter = new HighlightAdapter()
    const runtime = await adapter.initialize()
    const html = await runtime.codeToHtml('const x = 1', {
      lang: 'js',
      meta: { __raw: '' },
    })
    expect(html).toContain('<pre')
    expect(html).toContain('<code>')
    expect(html).toContain('class="line"')
    expect(html).toContain('data-code-engine="highlight"')
    expect(html).toContain('data-highlighted="true"')
    expect(html).toContain('data-lang="javascript"')
    expect(html).toContain('bd-token-')
    expect(html).toContain('token keyword')
  })

  it('renders TypeScript/TSX via aliases', async () => {
    const adapter = new HighlightAdapter()
    const runtime = await adapter.initialize()
    const ts = await runtime.codeToHtml('const n: number = 1', { lang: 'ts' })
    expect(ts).toContain('data-highlighted="true"')
    expect(ts).toContain('data-lang="typescript"')
    const tsx = await runtime.codeToHtml(
      'const A = () => <div className="x">hi</div>',
      { lang: 'tsx' },
    )
    expect(tsx).toContain('data-highlighted="true"')
  })

  it('renders plaintext for unknown language', async () => {
    const adapter = new HighlightAdapter()
    const runtime = await adapter.initialize()
    const html = await runtime.codeToHtml('some code', {
      lang: 'definitely-not-a-real-language-xyz',
      meta: { __raw: '' },
    })
    expect(html).toContain('data-code-state="plaintext"')
    expect(html).toContain('data-highlighted="false"')
  })

  it('renders plaintext via renderPlaintext', async () => {
    const adapter = new HighlightAdapter()
    const html = await adapter.renderPlaintext('raw <code>', { lang: 'text' })
    expect(html).toContain('<pre')
    expect(html).toContain('raw &lt;code&gt;')
    expect(html).toContain('data-code-state="plaintext"')
  })

  it('ensureLanguage loads known languages and aliases', async () => {
    const adapter = new HighlightAdapter()
    expect(await adapter.ensureLanguage('js')).toBe(true)
    expect(await adapter.ensureLanguage('ts')).toBe(true)
    expect(await adapter.ensureLanguage('typescript')).toBe(true)
    expect(await adapter.ensureLanguage('bash')).toBe(true)
    expect(await adapter.ensureLanguage('python')).toBe(true)
  })

  it('ensureLanguage returns false for unknown languages', async () => {
    const adapter = new HighlightAdapter()
    expect(await adapter.ensureLanguage('not-a-language')).toBe(false)
  })

  it('returns HAST with pre/code/line structure', async () => {
    const adapter = new HighlightAdapter()
    const runtime = await adapter.initialize()
    const hast = runtime.codeToHast('a\nb', { lang: 'js' }) as any
    expect(hast.type).toBe('root')
    const pre = hast.children[0]
    expect(pre.tagName).toBe('pre')
    expect(pre.children[0].tagName).toBe('code')
    expect(pre.children[0].children[0].properties.className).toContain('line')
  })

  it('passes meta flags into output attributes', async () => {
    const adapter = new HighlightAdapter()
    const runtime = await adapter.initialize()
    const html = await runtime.codeToHtml('x', {
      lang: 'js',
      title: 'demo',
      lineNumbers: true,
      wordWrap: true,
    })
    expect(html).toContain('data-title="demo"')
    expect(html).toContain('data-line-numbers="true"')
    expect(html).toContain('data-word-wrap="true"')
  })
})
