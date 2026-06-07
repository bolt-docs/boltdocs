import { useMemo } from 'react'
import katex from 'katex'

export interface BlockMathProps {
  children: string
}

export function BlockMath({ children }: BlockMathProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(children, { displayMode: true })
    } catch {
      return children
    }
  }, [children])

  return (
    <div
      className="math-block my-6 flex justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
