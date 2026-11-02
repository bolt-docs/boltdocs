import { useEffect, useState } from 'react'

export interface BlockMathProps {
  children: string
  /** Pre-rendered KaTeX HTML, baked at build time by the math plugin. */
  html?: string
}

/**
 * Block math. Same contract as `MathComponent`: the build-time transform bakes
 * KaTeX into `html`, so the critical client path never bundles KaTeX; direct
 * MDX usage falls back to an on-demand import.
 */
export function BlockMath({ children, html }: BlockMathProps) {
  const [lazyHtml, setLazyHtml] = useState<string | null>(null)

  useEffect(() => {
    if (typeof html === 'string' || lazyHtml !== null) return
    let active = true
    import('katex')
      .then((k) => {
        if (!active) return
        try {
          setLazyHtml(k.default.renderToString(children, { displayMode: true }))
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

  return (
    <div
      className="math-block my-6 flex justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: content }}
    />
  )
}
