import { Typographics } from '@/theme/mdx/typographics'
import { TableComponents } from '@/theme/mdx/table'
import { CodeBlock } from '@/theme/mdx/code-block'
import type { ReactNode } from 'react'
import { Callout } from '@/theme/mdx/callout'
import { Card } from './card'

const mdxComponents = {
  ...Typographics,
  ...TableComponents,
  pre: CodeBlock,
  Cards: ({ children }: { children: ReactNode }) => (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {children}
    </div>
  ),
  Card: Card,
  Callout,
}

export default mdxComponents
