import { defineHastPlugin } from 'satteri'
import type { HastVisitorContext } from 'satteri'
import type { Element, Properties } from 'hast'
import { toHtml } from 'hast-util-to-html'
import { parseMetaString, type ParsedMeta } from '@bdocs/unist-utils'

/** Engine-agnostic code theme (single name or light/dark pair). */
export type CodeTheme = string | { light: string; dark: string }

/**
 * Engine-agnostic highlighting config consumed by the satteri pipeline and
 * passed to the core's highlighter registry. `engine` accepts a registry id
 * (`'shiki'` by default), an adapter instance, or an adapter factory.
 */
export interface CodeHighlightConfig {
  engine?: string | object | ((api: CodeHighlightConfig) => unknown)
  theme?: CodeTheme
  options?: Record<string, unknown>
}

/** Legacy alias kept for backward compatibility. */
export type ShikiCodeTheme = CodeTheme

/** Structural runtime interface used by the plugin (engine-agnostic). */
interface CodeHighlighterResponse {
  name?: string
  initialize(): Promise<{
    codeToHast(code: string, options: Record<string, unknown>): unknown
    codeToHtml(code: string, options: Record<string, unknown>): Promise<string>
  }>
  getOptions(lang: string, meta: ParsedMeta): Record<string, unknown>
  ensureLanguage?(lang: string): Promise<boolean>
}

/**
 * Merge class arrays from two property sets.
 * Original node may use `className` (React convention) while the highlighter
 * output may use `class` (HAST convention). We normalize and merge.
 */
function mergeClassArrays(
  originalProps: Properties | undefined,
  engineProps: Properties | undefined,
): string[] {
  const origClass = originalProps?.className ?? originalProps?.class ?? []
  const engineClass = engineProps?.className ?? engineProps?.class ?? []
  return [
    ...(Array.isArray(engineClass) ? engineClass : [engineClass]),
    ...(Array.isArray(origClass) ? origClass : [origClass]),
  ].filter(Boolean) as string[]
}

/** Copies every property except class/className — those are merged by the caller. */
function copyNonClassProps(target: Properties, source?: Properties): void {
  const props = source ?? {}
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class' || key === 'className') continue
    target[key] = value
  }
}

/**
 * Assemble the replacement `<pre>` properties from the original node, the
 * engine output, and the framework metadata. Shared by the cache-hit and
 * cache-miss paths so both produce identical attribute sets.
 */
function assembleProperties(
  nodeProps: Properties | undefined,
  engineProps: Properties | undefined,
  ctx: {
    lang: string
    engineName: string
    themeMode: 'dual' | 'single'
    parsedMeta: ParsedMeta
  },
): Properties {
  const properties: Properties = {}
  copyNonClassProps(properties, nodeProps)
  copyNonClassProps(properties, engineProps)
  properties.className = mergeClassArrays(nodeProps, engineProps)
  properties['data-highlighted'] = 'true'
  properties['data-lang'] = ctx.lang
  properties['data-code-engine'] = ctx.engineName
  properties['data-theme-mode'] = ctx.themeMode
  if (ctx.parsedMeta.lineNumbers === true) {
    properties['data-line-numbers'] = 'true'
  }
  if (ctx.parsedMeta.wordWrap === true) {
    properties['data-word-wrap'] = 'true'
  }
  if (ctx.parsedMeta.title) {
    properties['data-title'] = ctx.parsedMeta.title
  }
  return properties
}

/**
 * Per-worker highlight cache: (lang + options + code) → serialized `<pre>`
 * HTML. Workers are long-lived (Piscina pool), so repeated snippets (install
 * commands, shared configs) highlight once per worker instead of once per
 * occurrence. The cache stores the engine's `<pre>` element too, so cache
 * hits skip both the grammar run and the HTML serialization.
 *
 * Key includes the resolved options (theme, transformers config) so a theme
 * change can never serve stale output; values are plain serialized strings
 * plus reusable HAST children.
 */
const HIGHLIGHT_CACHE_MAX = 2000
const highlightCache = new Map<string, { preElement: Element; html: string }>()

/**
 * Clear the per-worker highlight cache. Exposed for tests (isolation between
 * cases sharing lang+code) and for config-change invalidation.
 */
export function clearHighlightCache(): void {
  highlightCache.clear()
}

function cacheKeyFor(
  lang: string,
  options: Record<string, unknown>,
  code: string,
): string {
  // Options contain functions (transformers) — their identity is stable per
  // plugin instance, which is what the cache lifetime is bound to anyway.
  return `${lang}\u0000${JSON.stringify(options, replacerForCacheKey)}\u0000${code}`
}

/** JSON replacer that renders functions as a stable tag instead of dropping them. */
function replacerForCacheKey(_key: string, value: unknown): unknown {
  if (typeof value === 'function') {
    return `ƒ:${(value as { name?: string }).name ?? 'anon'}`
  }
  return value
}

/**
 * Syntax highlighting via a pluggable highlighter engine.
 *
 * Resolves the active {@link CodeHighlighterAdapter} from the core registry
 * (defaults to the built-in Shiki engine, switchable via
 * `theme.codeHighlighting.engine` or a plugin-provided engine), then renders
 * every code fence into an engine-neutral transport:
 *
 * - `data-highlighted="true"` — was rendered by an engine
 * - `data-highlighted-html` — HTML string for the CodeBlock component
 * - `data-code-engine` — the engine id that produced the block
 * - `data-theme-mode` — `dual` (light/dark pair) or `single`
 * - `data-line-numbers` / `data-word-wrap` — framework feature flags
 *
 * IMPORTANT: Sätteri's HAST lives in a Rust arena. Direct mutations on
 * `node.children` / `node.properties` are lost — the proxy only affects the
 * JS-side object and is never committed to the arena. Visitors must return a
 * new HastNode (triggers the replace command) or use `ctx.*` helpers.
 *
 * This plugin returns a replacement node containing the highlighted HAST.
 */
export function satteriRehypeCodeHighlightPlugin(config?: CodeHighlightConfig) {
  let adapter: CodeHighlighterResponse | null = null
  let runtime: {
    codeToHast(code: string, options: Record<string, unknown>): unknown
    codeToHtml(code: string, options: Record<string, unknown>): Promise<string>
  } | null = null
  let engineName = 'shiki'

  async function ensureHighlighter(): Promise<NonNullable<typeof runtime>> {
    if (adapter && runtime) return runtime
    const mod = await import('boltdocs/node/highlight')
    adapter = (await mod.getCodeHighlighterAdapter(
      config as never,
    )) as CodeHighlighterResponse
    engineName =
      adapter.name ||
      (typeof config?.engine === 'string' ? config.engine : 'shiki') ||
      'shiki'
    runtime = await adapter.initialize()
    return runtime
  }

  const themeMode: 'dual' | 'single' =
    config?.theme && typeof config.theme === 'object' ? 'dual' : 'single'

  return defineHastPlugin({
    name: 'boltdocs-rehype-code-highlight',
    element: {
      filter: ['pre'],
      async visit(node: Readonly<Element>, ctx: HastVisitorContext) {
        const highlighter = await ensureHighlighter()

        // Access children — HastChildStub materializes on read
        const codeNode = node.children?.[0]
        if (
          !codeNode ||
          codeNode.type !== 'element' ||
          codeNode.tagName !== 'code'
        ) {
          return
        }

        const className: string[] =
          (codeNode.properties?.className as string[] | undefined) ??
          (codeNode.properties?.class as string[] | undefined) ??
          []
        const langMatch = className.find((c: string) =>
          c.startsWith('language-'),
        )
        const lang = langMatch ? langMatch.slice(9) : 'text'

        if (lang === 'mermaid') return

        const metaStr: string =
          (codeNode.properties?.metastring as string | undefined) ??
          (codeNode.data as { meta?: string } | undefined)?.meta ??
          ''

        const parsedMeta = parseMetaString(metaStr)
        const options = adapter!.getOptions(lang, parsedMeta)

        // Load the grammar on demand for languages outside the eager
        // common set. No-op for plaintext-like or already-loaded languages;
        // failures keep the existing plaintext/fallback paths below.
        if (lang !== 'text') {
          await adapter?.ensureLanguage?.(lang)
        }

        const codeText =
          (codeNode.children?.[0] as { value?: string } | undefined)?.value ??
          ''

        try {
          const cacheKey = cacheKeyFor(lang, options, codeText)
          let preElement: Element
          let html: string | undefined

          const cached = highlightCache.get(cacheKey)
          if (cached) {
            // LRU refresh
            highlightCache.delete(cacheKey)
            highlightCache.set(cacheKey, cached)
            preElement = cached.preElement
            html = cached.html
          } else {
            const hast = highlighter.codeToHast(codeText, options)
            preElement =
              hast.type === 'root'
                ? (hast.children[0] as Element)
                : (hast as Element)

            // Single grammar pass: serialize the already-computed HAST instead
            // of re-running the TextMate grammar via codeToHtml. Cuts
            // highlighting CPU per block roughly in half.
            try {
              html = toHtml(preElement)
            } catch {
              // Serialization failure: fall back to HAST children (JSX path).
              // Whitespace may be trimmed but the block still renders.
            }

            if (html !== undefined) {
              if (highlightCache.size >= HIGHLIGHT_CACHE_MAX) {
                const oldest = highlightCache.keys().next().value
                if (oldest !== undefined) highlightCache.delete(oldest)
              }
              highlightCache.set(cacheKey, { preElement, html })
            }
          }

          const properties = assembleProperties(
            node.properties,
            preElement.properties,
            { lang, engineName, themeMode, parsedMeta },
          )
          if (html !== undefined) {
            properties['data-highlighted-html'] = html
          }

          return {
            type: 'element',
            tagName: 'pre',
            properties,
            children: preElement.children,
          } as unknown as Element
        } catch (highlightError) {
          // Language not bundled (or transient engine failure). Degrade
          // gracefully: retry as plaintext so the block keeps its engine
          // styling instead of silently falling back to an unformatted pre.
          if (lang !== 'plaintext') {
            try {
              const plainHast = highlighter.codeToHast(codeText, {
                ...options,
                lang: 'plaintext',
              })
              const plainPre: Element =
                plainHast.type === 'root'
                  ? (plainHast.children[0] as Element)
                  : (plainHast as Element)

              const properties: Properties = {}
              copyNonClassProps(properties, node.properties)
              copyNonClassProps(properties, plainPre.properties)
              properties.className = mergeClassArrays(
                node.properties,
                plainPre.properties,
              )
              properties['data-highlighted'] = 'true'
              properties['data-lang'] = lang
              properties['data-code-engine'] = engineName
              properties['data-theme-mode'] = themeMode
              if (parsedMeta.lineNumbers === true) {
                properties['data-line-numbers'] = 'true'
              }
              if (parsedMeta.wordWrap === true) {
                properties['data-word-wrap'] = 'true'
              }

              console.warn(
                `[boltdocs] Highlighter language "${lang}" is not bundled; falling back to plaintext highlighting for this code block.`,
                highlightError instanceof Error
                  ? highlightError.message
                  : highlightError,
              )

              if (parsedMeta.title) {
                properties['data-title'] = parsedMeta.title
              }

              // Generate HTML for plaintext fallback too.
              try {
                const plainHtml = await highlighter.codeToHtml(codeText, {
                  ...options,
                  lang: 'plaintext',
                })
                properties['data-highlighted-html'] = plainHtml
              } catch {
                // Ignore — fall back to HAST children.
              }

              return {
                type: 'element',
                tagName: 'pre',
                properties,
                children: plainPre.children,
              } as unknown as Element
            } catch {
              // Fall through to the fallback path below.
            }
          }

          // Fallback: add shiki-fallback class
          const properties: Properties = {}
          const originalProps = node.properties ?? {}
          copyNonClassProps(properties, node.properties)

          properties.className = [
            ...(((originalProps?.className ?? originalProps?.class) as
              | string[]
              | undefined) ?? []),
            'shiki-fallback',
          ]
          properties['data-highlighted'] = 'false'
          properties['data-lang'] = lang
          properties['data-code-engine'] = engineName
          properties['data-theme-mode'] = themeMode

          if (parsedMeta.title) {
            properties['data-title'] = parsedMeta.title
          }

          return {
            type: 'element',
            tagName: 'pre',
            properties,
            children: node.children,
          } as unknown as Element
        }
      },
    },
  })
}

/**
 * @deprecated Use {@link satteriRehypeCodeHighlightPlugin} instead — the
 * plugin is engine-agnostic (Shiki is just the default engine).
 */
export const satteriRehypeShikiPlugin = satteriRehypeCodeHighlightPlugin
