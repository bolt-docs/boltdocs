import { useEffect, useState } from 'react'

export interface MathProps {
  children: string
  /** Pre-rendered KaTeX HTML, baked at build time by the math plugin. */
  html?: string
}

/**
 * Inline math. When the build-time transform has baked the KaTeX output into
 * the `html` prop, this renders synchronously and KaTeX is never bundled into
 * the critical path. For direct MDX usage without the bake (rare), KaTeX is
 * imported on demand and the raw TeX stays visible until it arrives — the
 * server and the first client render agree, so hydration stays consistent.
 */
export function MathComponent({ children, html }: MathProps) {
  const [lazyHtml, setLazyHtml] = useState<string | null>(null)

  useEffect(() => {
    if (typeof html === 'string' || lazyHtml !== null) return
    let active = true
    import('katex')
      .then((k) => {
        if (!active) return
        try {
          setLazyHtml(
            k.default.renderToString(children, { displayMode: false }),
          )
        } catch {
          setLazyHtml(children)
        }
      })
      .catch(() => {
        if (active) setLazyHtml(children)
      })
    return () => {
      active = false
    }
  }, [html, children, lazyHtml])

  const content = typeof html === 'string' ? html : (lazyHtml ?? children)

  return <span dangerouslySetInnerHTML={{ __html: content }} />
}
