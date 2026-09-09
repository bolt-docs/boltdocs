import { defineHastPlugin } from 'satteri'
import type { HastVisitorContext } from 'satteri'
import type { Element, Properties } from 'hast'

interface ParsedMeta {
  title?: string
  lineNumbers?: boolean
  wordWrap?: boolean
}

/** Resolved `codeTheme` from the user config (single theme or light/dark pair). */
export type ShikiCodeTheme =
  | string
  | { light: string; dark: string }
  | undefined

function parseMetaString(metaStr: string): ParsedMeta {
  const result: ParsedMeta = {}
  if (!metaStr) return result

  const setBooleanFlag = (
    key: 'lineNumbers' | 'wordWrap',
    value?: string,
  ): void => {
    if (value === 'false') {
      result[key] = false
      return
    }
    if (value === 'true' || value === undefined) {
      result[key] = true
    }
  }

  const lineMatches = Array.from(
    metaStr.matchAll(
      /(?:^|\s)(?:lineNumbers|showLineNumbers|show-line-numbers|show_line_numbers|line_numbers)(?:\s*=\s*(true|false))?(?=\s|$)/gi,
    ),
  )
  const lastLineMatch = lineMatches[lineMatches.length - 1]
  if (lastLineMatch) {
    setBooleanFlag('lineNumbers', lastLineMatch[1])
  }

  const wordMatches = Array.from(
    metaStr.matchAll(
      /(?:^|\s)(?:wordWrap|word-wrap|word_wrap)(?:\s*=\s*(true|false))?(?=\s|$)/gi,
    ),
  )
  const lastWordMatch = wordMatches[wordMatches.length - 1]
  if (lastWordMatch) {
    setBooleanFlag('wordWrap', lastWordMatch[1])
  }

  const titleMatch = metaStr.match(/title=(['"])(.*?)\1/)
  if (titleMatch) result.title = titleMatch[2]
  return result
}

/**
 * Merge class arrays from two property sets.
 * Original node may use `className` (React convention) while Shiki output
 * may use `class` (HAST convention). We normalize and merge.
 */
function mergeClassArrays(
  originalProps: Properties | undefined,
  shikiProps: Properties | undefined,
): string[] {
  const origClass = originalProps?.className ?? originalProps?.class ?? []
  const shikiClass = shikiProps?.className ?? shikiProps?.class ?? []
  return [
    ...(Array.isArray(shikiClass) ? shikiClass : [shikiClass]),
    ...(Array.isArray(origClass) ? origClass : [origClass]),
  ].filter(Boolean) as string[]
}

/** Minimal shiki adapter interface used at runtime. */
interface ShikiAdapter {
  getHighlighter(): Promise<{
    codeToHast: (
      code: string,
      options: Record<string, unknown>,
    ) => { type: string; children: (Element | { type: string })[] } | Element
    codeToHtml: (
      code: string,
      options: Record<string, unknown>,
    ) => Promise<string>
  }>
  getOptions(lang: string, meta: ParsedMeta): Record<string, unknown>
}

type EnsureLanguageFn = (lang?: string) => Promise<boolean>

/**
 * Syntax highlighting via Shiki.
 * Port of rehypeShiki to Sätteri HAST.
 *
 * IMPORTANT: Sätteri's HAST lives in a Rust arena. Direct mutations on
 * `node.children` / `node.properties` are lost — the proxy only affects the
 * JS-side object and is never committed to the arena. Instead, visitors must
 * either:
 *   - Return a new HastNode to replace the current one (triggers replace command)
 *   - Use ctx.replaceNode() / ctx.setProperty() etc.
 *
 * This plugin returns a replacement node containing the Shiki-highlighted HAST.
 */
export function satteriRehypeShikiPlugin(codeTheme?: ShikiCodeTheme) {
  let adapter: ShikiAdapter | null = null
  let ensureLang: EnsureLanguageFn | null = null
  let highlighterPromise: Promise<
    ReturnType<ShikiAdapter['getHighlighter']> extends Promise<infer T>
      ? T
      : never
  > | null = null

  return defineHastPlugin({
    name: 'boltdocs-rehype-shiki',
    element: {
      filter: ['pre'],
      async visit(node: Readonly<Element>, ctx: HastVisitorContext) {
        // Lazy load adapter and highlighter (atomic init to prevent race conditions)
        if (!adapter) {
          const mod = await import('boltdocs/node/mdx/shiki-adapter')
          // Pass the resolved codeTheme so the adapter honors the user config
          // instead of falling back to the default light/dark pair. This is
          // what makes `codeTheme: 'github-dark'` produce single-theme inline
          // colors rather than dual-theme CSS variables.
          adapter = mod.getShikiAdapter(
            codeTheme
              ? ({ theme: { codeTheme } } as Parameters<
                  typeof mod.getShikiAdapter
                >[0])
              : undefined,
          ) as unknown as ShikiAdapter
          highlighterPromise = adapter.getHighlighter()
          ensureLang = mod.ensureLanguage as unknown as EnsureLanguageFn
        }
        const highlighter = await highlighterPromise!

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
        const options = adapter.getOptions(lang, parsedMeta)

        // Load the grammar on demand for languages outside the eager
        // common set. No-op for plaintext-like or already-loaded languages;
        // failures keep the existing plaintext/fallback paths below.
        if (lang !== 'text') {
          await ensureLang?.(lang)
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

          // Merge class arrays from original and Shiki output.
          const mergedClassName = mergeClassArrays(
            node.properties,
            preElement.properties,
          )

          // Build properties by iterating ALL original property keys and
          // explicitly copying each one, SKIPPING class/className entirely.
          const properties: Properties = {}
          const originalProps = node.properties ?? {}
          for (const key of Object.keys(originalProps)) {
            if (key === 'class' || key === 'className') continue
            properties[key] = originalProps[key]
          }

          // Add Shiki-specific properties (style, etc.) but skip class/className
          const shikiProps = preElement.properties ?? {}
          for (const [key, value] of Object.entries(shikiProps)) {
            if (key === 'class' || key === 'className') continue
            properties[key] = value
          }

          // Set single unified className
          properties.className = mergedClassName
          properties['data-highlighted'] = 'true'
          properties['data-lang'] = lang

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
          // Language not bundled (or transient Shiki failure). Degrade
          // gracefully: retry as plaintext so the block keeps its Shiki
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
              const originalProps = node.properties ?? {}
              for (const key of Object.keys(originalProps)) {
                if (key === 'class' || key === 'className') continue
                properties[key] = originalProps[key]
              }
              const plainProps = plainPre.properties ?? {}
              for (const [key, value] of Object.entries(plainProps)) {
                if (key === 'class' || key === 'className') continue
                properties[key] = value
              }
              properties.className = mergeClassArrays(
                node.properties,
                plainPre.properties,
              )
              properties['data-highlighted'] = 'true'
              properties['data-lang'] = lang

              console.warn(
                `[boltdocs] Shiki language "${lang}" is not bundled; falling back to plaintext highlighting for this code block.`,
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
              // Fall through to the shiki-fallback path below.
            }
          }

          // Fallback: add shiki-fallback class
          const properties: Properties = {}
          const originalProps = node.properties ?? {}
          for (const key of Object.keys(originalProps)) {
            if (key === 'class' || key === 'className') continue
            properties[key] = originalProps[key]
          }

          properties.className = [
            ...(((originalProps?.className ?? originalProps?.class) as
              | string[]
              | undefined) ?? []),
            'shiki-fallback',
          ]
          properties['data-highlighted'] = 'false'
          properties['data-lang'] = lang

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
