import { useLoaderData } from 'react-router-dom'
import { useMergedComponents } from 'boltdocs/client'
import type { CollectionPostLoaderData } from 'boltdocs/client'

export default function BlogPost({ MDXComponent, mdxComponents }: any) {
  const data = useLoaderData() as CollectionPostLoaderData
  const { route } = data
  const { title, date, author, excerpt, lastUpdated } = route

  const allComponents = useMergedComponents(mdxComponents)
  const { LastUpdated } = allComponents

  return (
    <article className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <header className="mb-10 pb-8 border-b border-gray-200 dark:border-gray-800">
        {title && (
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4">
            {title}
          </h1>
        )}

        <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400 mt-6">
          {date && (
            <time dateTime={new Date(date).toISOString()}>
              {new Date(date).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </time>
          )}

          {author && (
            <>
              <span aria-hidden="true">&middot;</span>
              <img
                src={typeof author === 'string' ? author : author.avatar}
                alt={typeof author === 'string' ? author : author.name}
                className="w-8 h-8 rounded-full"
              />
              <span>{typeof author === 'string' ? author : author.name}</span>
            </>
          )}
        </div>

        {excerpt && (
          <p className="mt-6 text-xl text-gray-600 dark:text-gray-300">
            {excerpt}
          </p>
        )}
      </header>

      <div className="prose prose-blue dark:prose-invert max-w-none">
        <MDXComponent components={allComponents} />
      </div>

      {lastUpdated && LastUpdated && (
        <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-800">
          <LastUpdated date={lastUpdated} />
        </div>
      )}
    </article>
  )
}
