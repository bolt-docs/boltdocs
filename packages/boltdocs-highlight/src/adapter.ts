import Prism from 'prismjs'
import { normalizeCodeHighlightConfig } from '@bdocs/unist-utils'
import { normalizeTheme } from './themes.js'
import { canonicalLanguage, ensurePrismLanguage } from './languages.js'
import type {
  CodeHighlighterAdapter,
  CodeHighlighterRuntime,
  CodeHighlightConfig,
} from '@bdocs/contracts'
import type { ParsedMetaLike } from '@bdocs/contracts'

export const ADAPTER_NAME = 'highlight'

type PrismToken =
  | string
  | { type: string; content: PrismTokenStream; alias?: string | string[] }
type PrismTokenStream = PrismToken | PrismToken[]

function metaFrom(parsed: ParsedMetaLike | undefined) {
  if (!parsed) return {}
  return {
    title: typeof parsed.title === 'string' ? parsed.title : undefined,
    lineNumbers: parsed.lineNumbers === true,
    wordWrap: parsed.wordWrap === true,
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Map Prism token types/aliases to Boltdocs token classes for CSS-var theming.
const BD_TYPE: Record<string, string> = {
  keyword: 'keyword',
  builtin: 'builtin',
  'class-name': 'type',
  type: 'type',
  string: 'string',
  char: 'string',
  template: 'string',
  'template-string': 'string',
  'template-punctuation': 'string',
  number: 'number',
  comment: 'comment',
  prolog: 'comment',
  cdata: 'comment',
  doctype: 'doctype',
  function: 'function',
  'function-variable': 'function',
  method: 'function',
  operator: 'operator',
  punctuation: 'punctuation',
  boolean: 'boolean',
  constant: 'boolean',
  null: 'null',
  nil: 'null',
  undefined: 'null',
  regex: 'regex',
  'attr-name': 'attribute',
  attribute: 'attribute',
  property: 'attribute',
  selector: 'attribute',
  tag: 'tag',
  entity: 'entity',
  symbol: 'entity',
  directive: 'directive',
  atrule: 'directive',
  important: 'keyword',
  interpolation: 'interpolation',
  'interpolation-punctuation': 'interpolation',
  namespace: 'meta',
  annotation: 'annotation',
  decorator: 'decorator',
  label: 'label',
  url: 'string',
  variable: 'builtin',
  parameter: 'builtin',
  deleted: 'keyword',
  inserted: 'string',
}

function bdType(type: string, alias?: string | string[]): string {
  const aliases = alias ? (Array.isArray(alias) ? alias : [alias]) : []
  for (const name of [type, ...aliases]) {
    if (BD_TYPE[name]) return BD_TYPE[name]
  }
  // fallback: first segment of dotted/compound types
  const base = type.split(/[-_.]/)[0]
  return BD_TYPE[base] ?? type
}

function flatten(
  stream: PrismTokenStream,
  parent?: { type: string; alias?: string | string[] },
): Array<{ text: string; types: string[] }> {
  const out: Array<{ text: string; types: string[] }> = []
  const items = Array.isArray(stream) ? stream : [stream]
  for (const item of items) {
    if (typeof item === 'string') {
      if (item)
        out.push({
          text: item,
          types: parent ? [bdType(parent.type, parent.alias), parent.type] : [],
        })
      continue
    }
    const types = [bdType(item.type, item.alias), item.type]
    const aliases = item.alias
      ? Array.isArray(item.alias)
        ? item.alias
        : [item.alias]
      : []
    types.push(...aliases)
    // nested content: recurse with this token as context for class mapping
    const inner = flatten(item.content, item)
    for (const seg of inner) {
      // prefer most specific (inner) mapping but keep prism token type on wrapper via classes at render time
      out.push({ text: seg.text, types: seg.types.length ? seg.types : types })
    }
  }
  return out
}

function splitLines(
  flat: Array<{ text: string; types: string[] }>,
): Array<Array<{ text: string; types: string[] }>> {
  const lines: Array<Array<{ text: string; types: string[] }>> = [[]]
  for (const seg of flat) {
    const parts = seg.text.split('\n')
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) lines.push([])
      const text = parts[i]
      if (text.length === 0) continue
      lines[lines.length - 1].push({ text, types: seg.types })
    }
  }
  if (lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop()
  return lines.length ? lines : [[]]
}

function spanHtml(seg: { text: string; types: string[] }): string {
  const escaped = escapeHtml(seg.text)
  if (!seg.types.length) return escaped
  const prism = seg.types.filter(Boolean)
  // primary Boltdocs class + Prism-compatible classes for theme flexibility
  const bd = prism[0] ? `bd-token-${prism[0]}` : ''
  const rest = prism
    .slice(1)
    .map((t) => `token ${t}`)
    .join(' ')
  const cls = [bd, rest].filter(Boolean).join(' ')
  return `<span class="${cls}">${escaped}</span>`
}

function spanHast(seg: { text: string; types: string[] }): unknown {
  if (!seg.types.length) return { type: 'text', value: seg.text }
  const prism = seg.types.filter(Boolean)
  const bd = prism[0] ? `bd-token-${prism[0]}` : ''
  const className = [bd, 'token', ...prism.slice(1)].filter(Boolean)
  return {
    type: 'element',
    tagName: 'span',
    properties: { className },
    children: [{ type: 'text', value: seg.text }],
  }
}

function baseAttrs(
  lang: string,
  state: 'highlighted' | 'plaintext' | 'fallback',
  options: Record<string, unknown>,
  highlighted = state === 'highlighted',
): string {
  const parts: string[] = []
  if (lang && lang !== 'plain') parts.push(` data-lang="${escapeHtml(lang)}"`)
  parts.push(` data-code-state="${state}"`)
  parts.push(` data-code-engine="${ADAPTER_NAME}"`)
  parts.push(` data-highlighted="${highlighted ? 'true' : 'false'}"`)
  if (options.lineNumbers === true) parts.push(' data-line-numbers="true"')
  if (options.wordWrap === true) parts.push(' data-word-wrap="true"')
  if (typeof options.title === 'string' && options.title) {
    parts.push(` data-title="${escapeHtml(options.title)}"`)
  }
  if (state === 'plaintext') parts.push(' class="bd-code-plaintext"')
  return parts.join('')
}

function htmlProps(
  lang: string,
  state: 'highlighted' | 'plaintext',
  options: Record<string, unknown>,
  highlighted: boolean,
): Record<string, unknown> {
  const props: Record<string, unknown> = {
    'data-code-state': state,
    'data-code-engine': ADAPTER_NAME,
    'data-highlighted': highlighted ? 'true' : 'false',
  }
  if (lang && lang !== 'plain') props['data-lang'] = lang
  if (options.lineNumbers === true) props['data-line-numbers'] = 'true'
  if (options.wordWrap === true) props['data-word-wrap'] = 'true'
  if (typeof options.title === 'string' && options.title)
    props['data-title'] = options.title
  if (state === 'plaintext') props.className = ['bd-code-plaintext']
  return props
}

export class HighlightAdapter implements CodeHighlighterAdapter {
  name = ADAPTER_NAME
  version = '2.0.0'

  private theme: { light: string; dark: string }

  constructor(config?: CodeHighlightConfig) {
    const highlighting = normalizeCodeHighlightConfig(config)
    this.theme = normalizeTheme(highlighting?.theme)
  }

  getOptions(lang: string, meta: ParsedMetaLike): Record<string, unknown> {
    return { lang, ...metaFrom(meta), meta: meta ?? {}, theme: this.theme }
  }

  async initialize(): Promise<CodeHighlighterRuntime> {
    return {
      codeToHast: (code: string, options: Record<string, unknown>) =>
        this.renderToHast(code, options),
      codeToHtml: async (code: string, options: Record<string, unknown>) =>
        this.renderToHtml(code, options),
    }
  }

  async ensureLanguage(lang: string): Promise<boolean> {
    return ensurePrismLanguage(Prism, lang) !== null
  }

  async renderPlaintext(
    code: string,
    options: Record<string, unknown>,
  ): Promise<string> {
    const lang = canonicalLanguage(String(options.lang ?? 'plain'))
    const attrs = baseAttrs(lang, 'plaintext', options, false)
    return `<pre${attrs}><code>${escapeHtml(code)}</code></pre>`
  }

  prewarm(_options?: Record<string, unknown>): void {
    // Grammars load on demand; no global warmup required.
  }

  private tokenizeCode(
    code: string,
    requested: string,
  ): {
    lang: string
    lines: Array<Array<{ text: string; types: string[] }>> | null
  } {
    const lang = canonicalLanguage(requested)
    if (lang === 'plain') return { lang, lines: null }
    const id = ensurePrismLanguage(Prism, requested)
    const grammar = id ? Prism.languages[id] : null
    if (!id || !grammar)
      return { lang: canonicalLanguage(requested), lines: null }
    const stream = Prism.tokenize(code, grammar) as PrismTokenStream
    const flat = flatten(stream)
    return { lang: id, lines: splitLines(flat) }
  }

  private renderToHast(
    code: string,
    options: Record<string, unknown>,
  ): unknown {
    const requested = String(options.lang ?? 'plain')
    const { lang, lines } = this.tokenizeCode(code, requested)
    const highlighted = !!lines
    const state = highlighted ? 'highlighted' : 'plaintext'
    const effectiveLines = lines ?? [[{ text: code, types: [] as string[] }]]
    // if plaintext but code had newlines, split plainly
    const finalLines = highlighted ? effectiveLines : splitPlain(code)
    return {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: htmlProps(lang, state, options, highlighted),
          children: [
            {
              type: 'element',
              tagName: 'code',
              properties: {},
              children: finalLines.map((line) => ({
                type: 'element',
                tagName: 'span',
                properties: { className: ['line'] },
                children: line.map((seg) =>
                  highlighted
                    ? spanHast(seg)
                    : { type: 'text', value: seg.text },
                ),
              })),
            },
          ],
        },
      ],
    }
  }

  private renderToHtml(code: string, options: Record<string, unknown>): string {
    const requested = String(options.lang ?? 'plain')
    const { lang, lines } = this.tokenizeCode(code, requested)
    const highlighted = !!lines
    const state = highlighted ? 'highlighted' : 'plaintext'
    const finalLines = highlighted ? lines! : splitPlain(code)
    const attrs = baseAttrs(lang, state, options, highlighted)
    const inner = finalLines
      .map(
        (line) =>
          `<span class="line">${highlighted ? line.map(spanHtml).join('') : escapeHtml(line.map((s) => s.text).join(''))}</span>`,
      )
      .join('\n')
    return `<pre${attrs}><code>${inner}</code></pre>`
  }
}

function splitPlain(
  code: string,
): Array<Array<{ text: string; types: string[] }>> {
  const parts = code.split('\n')
  if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop()
  return parts.map((t) => (t ? [{ text: t, types: [] }] : []))
}

export { escapeHtml }
