import {
  resolvePublicAssetUrl,
  useConfig,
  useMergedComponents,
  usePost,
} from 'boltdocs/client'
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
  const config = useConfig()
  if (!post) return null

  const { title, date, author, lastUpdated, coverImage, tags } = post

  const authorMeta =
    (typeof author === 'object' && author !== null
      ? author
      : (post.frontmatter?.author as
          | { name?: string; avatar?: string; image?: string }
          | undefined)) ?? null
  const authorName =
    authorMeta?.name || (typeof author === 'string' ? author : '')
  const authorAvatarRaw = authorMeta?.avatar || authorMeta?.image || ''
  const authorAvatar =
    authorAvatarRaw &&
    (authorAvatarRaw.startsWith('/') ||
      /^https?:/i.test(authorAvatarRaw) ||
      /^data:/i.test(authorAvatarRaw))
      ? resolvePublicAssetUrl(authorAvatarRaw, config.base)
      : ''

  const allComponents = useMergedComponents(mdxComponents)
  const { LastUpdated } = allComponents

  return (
    <article className="max-w-3xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <header className="mb-10 pb-10 border-b border-subtle">
        {title && (
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-body mb-4 leading-tight">
            {title}
          </h1>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 text-sm text-muted mt-6">
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
              <span className="flex items-center gap-2.5">
                {authorAvatar ? (
                  <img
                    src={authorAvatar}
                    alt={authorName}
                    width={36}
                    height={36}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="size-9 rounded-full object-cover ring-1 ring-subtle"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex size-9 items-center justify-center rounded-full bg-soft text-sm font-semibold text-body"
                  >
                    {authorName?.charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="text-body font-medium">{authorName}</span>
              </span>
            </>
          )}
        </div>

        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-5">
            {tags.map((tag: string) => (
              <span
                key={tag}
                className="px-2.5 py-1 text-[11px] font-medium rounded-full bg-primary-500/10 text-primary-400 border border-primary-500/20"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {coverImage && (
          <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-soft mt-8 mb-6 border border-subtle">
            <img
              src={resolvePublicAssetUrl(coverImage, config.base)}
              alt={title || 'Cover image'}
              className="object-cover w-full h-full"
            />
          </div>
        )}
      </header>

      <div className="max-w-none">
        <MDXComponent components={allComponents} />
      </div>

      {lastUpdated && LastUpdated && (
        <div className="mt-12 pt-8 border-t border-subtle">
          <LastUpdated date={lastUpdated} />
        </div>
      )}
    </article>
  )
}
