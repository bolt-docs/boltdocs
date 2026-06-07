import { useMemo } from 'react'
import katex from 'katex'

export interface MathProps {
  children: string
}

export function Math({ children }: MathProps) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(children, { displayMode: false })
    } catch {
      return children
    }
  }, [children])

  return <span dangerouslySetInnerHTML={{ __html: html }} />
}
