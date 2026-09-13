import { OnThisPage } from '@/theme'
import { useMergedComponents, usePost } from 'boltdocs/client'
import type { ReactNode, ComponentType } from 'react'

interface BlogPostProps {
  MDXComponent: (props: {
    components: Record<string, ComponentType<Record<string, unknown>>>
  }) => ReactNode
  mdxComponents?: Record<string, ComponentType<Record<string, unknown>>>
}

export default function BlogPost({
  MDXComponent,
  mdxComponents,
}: BlogPostProps) {
  const post = usePost()
  if (!post) return null

  const { title, date, lastUpdated, headings } = post

  const allComponents = useMergedComponents(mdxComponents)
  const { LastUpdated } = allComponents

  return (
    <article className="max-w-4xl mx-auto py-12 mt-64 px-4 sm:px-6 lg:px-8">
      <header className="mb-10 pb-10 border-b border-subtle">
        <div className="flex flex-row gap-2 h-auto items-center justify-center">
          {date && (
            <time
              className="text-white text-center mb-6 block"
              dateTime={new Date(date).toISOString()}
            >
              {new Date(date).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          )}
        </div>
        {title && (
          <h1 className="text-3xl sm:text-4xl font-semibold text-center tracking-tight text-body mb-4 leading-tight">
            {title}
          </h1>
        )}
      </header>

      <div className="max-w-none flex flex-row gap-2">
        <div className="max-w-none">
          <MDXComponent components={allComponents} />
        </div>
        <div className="sticky">
          <OnThisPage headings={headings} />
        </div>
      </div>

      {lastUpdated && LastUpdated && (
        <div className="mt-12 pt-8">
          <LastUpdated date={lastUpdated} />
        </div>
      )}
    </article>
  )
}
