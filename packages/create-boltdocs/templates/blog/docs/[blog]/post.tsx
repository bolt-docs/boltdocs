import type { ComponentType } from 'react'
import { usePost, useMergedComponents } from 'boltdocs/client'

export default function BlogPost({
  MDXComponent,
  mdxComponents,
}: {
  MDXComponent: ComponentType<{ components?: Record<string, any> }>
  mdxComponents?: Record<string, any>
}) {
  const post = usePost()
  const allComponents = useMergedComponents(mdxComponents)

  if (!post) return null

  const { title, date, author, excerpt, coverImage, tags } = post

  return (
    <article className="max-w-3xl mx-auto py-10 px-4">
      <header className="mb-10">
        {title && (
          <h1 className="text-4xl font-extrabold tracking-tight mb-4">
            {title}
          </h1>
        )}

        <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
          {date && (
            <time dateTime={new Date(date).toISOString()}>
              {new Date(date).toLocaleDateString()}
            </time>
          )}
          {author && <span>· {author}</span>}
        </div>

        {coverImage && (
          <img
            src={coverImage}
            alt={title || 'Cover image'}
            className="mt-6 rounded-xl w-full"
          />
        )}

        {excerpt && (
          <p className="mt-6 text-xl text-neutral-600 dark:text-neutral-300">
            {excerpt}
          </p>
        )}
      </header>

      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <MDXComponent components={allComponents} />
      </div>

      {tags && tags.length > 0 && (
        <div className="mt-10 pt-6 border-t border-neutral-200 dark:border-neutral-800 flex gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="px-3 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-sm"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}
