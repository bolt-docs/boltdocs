import { defineHastPlugin } from 'satteri'
import type { HastVisitorContext } from 'satteri'
import type { Element, Properties } from 'hast'
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
          const hast = highlighter.codeToHast(codeText, options)
          const preElement: Element =
            hast.type === 'root'
              ? (hast.children[0] as Element)
              : (hast as Element)

          // Merge class arrays from original and engine output.
          const mergedClassName = mergeClassArrays(
            node.properties,
            preElement.properties,
          )

          // Copy every original property, skipping class/className entirely.
          const properties: Properties = {}
          copyNonClassProps(properties, node.properties)

          // Add engine-specific properties (style, etc.) but skip class/className.
          copyNonClassProps(properties, preElement.properties)

          // Set single unified className
          properties.className = mergedClassName
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

          if (parsedMeta.title) {
            properties['data-title'] = parsedMeta.title
          }

          // Generate HTML string and pass via data-highlighted-html so the
          // CodeBlock component renders it via dangerouslySetInnerHTML. This
          // bypasses JSX whitespace normalization (esbuild trims leading
          // whitespace from text nodes), preserving indentation in code blocks.
          try {
            const html = await highlighter.codeToHtml(codeText, options)
            properties['data-highlighted-html'] = html
          } catch {
            // If codeToHtml fails, fall back to HAST children (JSX path).
            // Whitespace may be trimmed but the block still renders.
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
