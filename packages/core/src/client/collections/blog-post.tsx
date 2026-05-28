import type { ComponentType } from 'react'
import { useLoaderData, Link } from 'react-router-dom'
import { LastUpdated } from '../components/ui-base'
import { useMergedComponents } from '../hooks/use-merged-components'
import { formatDate } from './utils'
import { Tags } from './tags'
import type { CollectionPostLoaderData } from '../types'

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

function Avatar({
  author,
}: {
  author: string | { name: string; avatar?: string; url?: string; image?: string }
}) {
  const name = typeof author === 'string' ? author : author.name
  const url =
    typeof author === 'object'
      ? author.avatar || author.url || author.image
      : undefined

  return (
    <div className="flex items-center gap-2.5">
      {url && (
        <img
          src={url}
          alt={name}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-xs font-bold text-primary-600 dark:bg-primary-500/20 dark:text-primary-400 select-none"
        />
      )}
      <span className="text-sm font-medium text-body">{name}</span>
    </div>
  )
}

/**
 * Renders a metadata field, optionally overriding the default renderer with a
 * custom component registered via `Frontmatter_<FieldName>` in mdx-components.
 */
function MetaField({
  field,
  value,
  components,
  label,
  fallback,
}: {
  field: string
  value: unknown
  components: Record<string, ComponentType<{ value: unknown }>>
  label?: string
  fallback: React.ReactNode
}) {
  if (value == null) return null
  if (Array.isArray(value) && value.length === 0) return null

  const Custom = components[field]
  const inner = Custom ? <Custom value={value} /> : fallback

  if (label) {
    return (
      <div>
        <p className="text-[11px] font-medium text-muted/60 uppercase tracking-wider mb-2">
          {label}
        </p>
        {inner}
      </div>
    )
  }

  return <>{inner}</>
}

// ---------------------------------------------------------------------------
// BlogPost
// ---------------------------------------------------------------------------

/**
 * Renders a single blog post, including its metadata sidebar, cover image,
 * and MDX content.
 *
 * Reads its data from the React Router loader via `useLoaderData()`, which
 * returns a `CollectionPostLoaderData` object. Accepts optional prop overrides
 * for the MDX component and custom component map.
 *
 * ### Custom frontmatter renderers
 *
 * Register a component named `Frontmatter_<Field>` (e.g. `Frontmatter_Author`)
 * in your `mdx-components.tsx` to override how a specific frontmatter field
 * is displayed in the sidebar. The component receives `{ value: unknown }`.
 *
 * ```tsx
 * // mdx-components.tsx
 * export const Frontmatter_Author = ({ value }) => <MyAuthorCard author={value} />
 * ```
 */
export function BlogPost({
  MDXComponent: propMDX,
  mdxComponents: propComponents,
}: {
  MDXComponent?: ComponentType<any>
  mdxComponents?: Record<string, ComponentType<any>>
}) {
  const data = useLoaderData() as CollectionPostLoaderData

  // The MDX component is passed as a prop from LazyMdxElement/EagerMdxElement
  const Component = propMDX
  const allComponents = useMergedComponents(propComponents)

  // Extract Frontmatter_* overrides from the merged component map
  const fmComponents = (allComponents?.Frontmatter || {}) as Record<
    string,
    React.ComponentType<{ value: any }>
  >

  if (!Component) return null

  const route = data?.route
  const collection = data?.collection || 'blog'

  // Pull fields from the route (promoted frontmatter) and fall back to raw frontmatter
  const fm = route?.frontmatter || {}
  const title = route?.title || fm.title
  const date = route?.date ?? fm.date
  const author = route?.author ?? fm.author
  const tags = route?.tags ?? fm.tags
  const coverImage = route?.coverImage ?? fm.coverImage
  const excerpt = route?.excerpt ?? fm.excerpt
  const lastUpdated = route?.lastUpdated

  const formattedDate = date ? formatDate(date) : null
  const defaultAuthor = author ? <Avatar author={author} /> : null

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[200px_1fr] gap-8 xl:gap-12">
      <aside className="hidden xl:block space-y-6">
        <div className="space-y-6">
          <MetaField
            field="author"
            value={author}
            components={fmComponents}
            label="Author"
            fallback={defaultAuthor}
          />
          <MetaField
            field="date"
            value={date}
            components={fmComponents}
            label="Published"
            fallback={<time className="text-sm text-muted">{formattedDate}</time>}
          />
          <MetaField
            field="tags"
            value={tags}
            components={fmComponents}
            label="Tags"
            fallback={<Tags tags={tags} />}
          />
          <MetaField
            field="coverImage"
            value={coverImage}
            components={fmComponents}
            label="Cover"
            fallback={
              <img
                src={coverImage}
                alt=""
                className="rounded-xl border border-subtle w-full"
              />
            }
          />
        </div>
      </aside>

      <article className="min-w-0 space-y-8">
        <div className="xl:hidden space-y-3">
          <MetaField
            field="author"
            value={author}
            components={fmComponents}
            fallback={defaultAuthor}
          />
          <MetaField
            field="date"
            value={date}
            components={fmComponents}
            fallback={
              <time className="block text-sm text-muted">{formattedDate}</time>
            }
          />
          <MetaField
            field="tags"
            value={tags}
            components={fmComponents}
            fallback={<Tags tags={tags} />}
          />
        </div>

        {coverImage && (
          <div className="xl:hidden">
            <MetaField
              field="coverImage"
              value={coverImage}
              components={fmComponents}
              fallback={
                <img
                  src={coverImage}
                  alt=""
                  className="rounded-xl border border-subtle w-full"
                />
              }
            />
          </div>
        )}

        <header className="space-y-4">
          <h1 className="text-3xl font-bold text-body leading-tight">{title}</h1>
          {excerpt && (
            <p className="text-lg text-muted leading-relaxed">{excerpt}</p>
          )}
        </header>

        <div className="prose prose-gray dark:prose-invert max-w-none">
          {Component && <Component components={allComponents} />}
        </div>

        {lastUpdated && <LastUpdated date={lastUpdated} />}

        <nav className="border-t border-subtle pt-6 mt-12">
          <Link
            to={`/${collection}`}
            className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-body transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <title>Arrow Left</title>
              <path
                fillRule="evenodd"
                d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
                clipRule="evenodd"
              />
            </svg>
            Back to {collection}
          </Link>
        </nav>
      </article>
    </div>
  )
}
