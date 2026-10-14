import { Link } from 'boltdocs/primitives'
import {
  resolvePublicAssetUrl,
  useConfig,
  useRecentPosts,
} from 'boltdocs/client'
import { formatDate } from 'boltdocs/client'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n/index'
import { Section } from '@/theme/section'

function PostCard({
  post,
  base,
}: {
  post: {
    path: string
    title: string
    date?: string | Date
    coverImage?: string
    excerpt?: string
    tags?: string[]
  }
  base: string | undefined
}) {
  return (
    <Link
      href={`site:${post.path}`}
      className="group flex w-80 shrink-0 flex-col overflow-hidden rounded-2xl bg-surface/60"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-code-bg">
        {post.coverImage ? (
          /**
           * The configured base is applied here. The cover path in frontmatter
           * is site-root-relative, and a site served under a sub-path needs the
           * base prefixed. Skipping it produces a 404 in the browser while the
           * server-rendered markup looks correct, and the differing `src` is a
           * hydration mismatch.
           */
          <img
            src={resolvePublicAssetUrl(post.coverImage, base)}
            alt={post.title}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-linear-to-br from-primary-500/15 to-accent-500/15" />
        )}
      </div>
      <div className="flex flex-col p-5 flex-1">
        {post.date && (
          <time className="text-[10px] font-mono text-muted mb-2">
            {/* Locale and zone are pinned so the server and the browser render
                the same string. */}
            {formatDate(post.date)}
          </time>
        )}
        <h3 className="text-base font-bold tracking-tight text-body group-hover:text-primary-300 transition-colors line-clamp-2 mb-2">
          {post.title}
        </h3>
      </div>
    </Link>
  )
}

export function FeaturedResources() {
  const recentPosts = useRecentPosts('blog', 4)
  const config = useConfig()
  const t = useTranslations()
  return (
    <Section maxWidth="xl" padding="md">
      <div className="mx-auto mb-12 max-md:mb-5 flex max-w-7xl flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-xl">
          <h2 className="text-3xl md:text-4xl text-center font-black tracking-tighter text-body mb-2">
            {t.featuredTitle}
          </h2>
        </div>
        <Link
          href="site:/blog"
          className="group hover:opacity-80 inline-flex max-md:hidden h-11 shrink-0 items-center justify-center px-6 text-sm font-medium text-body transition-all duration-300"
        >
          {t.featuredAll}
          <ArrowRight className="size-5 ml-2 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      {/* SSR-safe mobile behavior: only the first card shows below md.
          window.matchMedia at render time crashes SSR and would hydrate a
          different post count than the server rendered. */}
      <div className="mx-auto flex max-w-7xl max-md:justify-center [&>*+*]:max-md:hidden gap-6 overflow-x-auto scrollbar-hide">
        {recentPosts.map((post) => (
          <PostCard post={post} base={config.base} key={post.filePath} />
        ))}
      </div>
      <div className="mx-auto mt-5 max-w-7xl flex justify-center md:hidden">
        <Link
          href="site:/blog"
          className="group hidden hover:opacity-80 max-md:inline-flex h-11 shrink-0 items-center justify-center px-6 text-sm font-medium text-body transition-all duration-300"
        >
          {t.featuredAll}
          <ArrowRight className="size-5 ml-2 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </Section>
  )
}
