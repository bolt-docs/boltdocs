import { Link } from 'boltdocs/primitives'
import { useRecentPosts } from 'boltdocs/client'
import { ArrowRight } from 'lucide-react'
import { useTranslations } from '@/i18n/index'
import { Section } from '@/theme/section'

function PostCard({
  post,
}: {
  post: {
    path: string
    title: string
    date?: string
    coverImage?: string
    excerpt?: string
    tags?: string[]
  }
}) {
  return (
    <Link
      href={`site:${post.path}`}
      className="group flex w-80 shrink-0 flex-col overflow-hidden rounded-2xl bg-surface/60"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-code-bg">
        {post.coverImage ? (
          <img
            src={post.coverImage}
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
            {new Date(post.date).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
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
  const t = useTranslations()

  return (
    <Section maxWidth="lg">
      <div className="mx-auto mb-12 flex max-w-7xl flex-col justify-between gap-6 md:flex-row md:items-end">
        <div className="max-w-xl">
          <h2 className="text-3xl md:text-4xl font-black tracking-tighter text-body mb-2">
            {t.featuredTitle}
          </h2>
        </div>
        <Link
          href="site:/blog"
          className="group hover:opacity-80 inline-flex h-11 shrink-0 items-center justify-center px-6 text-sm font-medium text-body transition-all duration-300"
        >
          {t.featuredAll}
          <ArrowRight className="size-16 ml-2 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
      <div className="mx-auto flex max-w-7xl gap-6 overflow-x-auto scrollbar-hide">
        {recentPosts.map((post) => (
          <PostCard post={post} key={post.filePath} />
        ))}
      </div>
    </Section>
  )
}
