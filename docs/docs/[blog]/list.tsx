import { useMemo, useState } from 'react'
import { useConfig, useI18n, usePosts } from 'boltdocs/client'
import type { CollectionPost } from 'boltdocs/client'
import { Link } from 'boltdocs/primitives'
import { Button } from '@/theme/button'
import { Section } from '@/theme'
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react'

const translations = {
  es: {
    blogs: 'Blog',
    previous: 'Anterior',
    next: 'Siguiente',
    pageof: 'Página {page} de {totalPages}',
    description:
      'Release notes, deep dives and announcements — ordenados cronológicamente.',
  },
  en: {
    blogs: 'Blog',
    previous: 'Previous',
    next: 'Next',
    pageof: 'Page {page} of {totalPages}',
    description:
      'Release notes, deep dives and announcements — in chronological order.',
  },
}

/** Number of most recent posts shown as the featured hero cards. */
const FEATURED_COUNT = 2

function formatDate(date: string | Date | undefined, locale: string) {
  if (!date) return null
  const d = new Date(date)
  return d.toLocaleDateString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface PostCardProps {
  post: CollectionPost
  href: string
  locale: string
  featured?: boolean
  base: string | undefined
}

function PostCard({ post, href, locale, featured = false }: PostCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col text-left outline-none h-full focus-visible:bg-soft"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-soft">
        {post.coverImage ? (
          <img
            src={post.coverImage}
            alt={post.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="absolute inset-0 flex items-center justify-center bg-surface group-hover:bg-soft"
          >
            <span className="text-4xl font-black text-strong transition-colors group-hover:text-primary-400">
              {post.title.charAt(0)}
            </span>
          </div>
        )}
      </div>

      <div
        className={`flex flex-1 flex-col bg-surface transition-colors duration-200 group-hover:bg-soft ${
          featured ? 'gap-2.5 p-6' : 'gap-2 p-5'
        }`}
      >
        <h2
          className={`font-black tracking-tight text-body transition-colors group-hover:text-primary-300 ${
            featured ? 'text-xl md:text-2xl' : 'text-base'
          }`}
        >
          {post.title}
        </h2>

        {featured && post.excerpt && (
          <p className="line-clamp-2 text-sm leading-relaxed text-paragraph">
            {post.excerpt}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-4 pt-1">
          <time className="text-xs font-medium uppercase tracking-wide text-muted">
            {formatDate(post.date, locale) ?? ''}
          </time>
          <ArrowUpRight
            aria-hidden="true"
            className="size-16 shrink-0 text-muted transition-colors group-hover:text-primary-400"
          />
        </div>
      </div>
    </Link>
  )
}

export default function BlogList() {
  const allPosts = usePosts()
  const { currentLocale } = useI18n()
  const config = useConfig()
  const [page, setPage] = useState(1)
  const perPage = 15
  const totalPages = Math.max(1, Math.ceil(allPosts.length / perPage))
  const locale = currentLocale === 'es' ? 'es' : 'en'
  const t = translations[locale] || translations.en

  const { featured, rest } = useMemo(() => {
    const featuredPosts = allPosts.slice(0, FEATURED_COUNT)
    const restPosts = allPosts.slice(FEATURED_COUNT)
    return { featured: featuredPosts, rest: restPosts }
  }, [allPosts])

  const restStartIndex = (page - 1) * perPage
  const restPosts = rest.slice(restStartIndex, restStartIndex + perPage)

  return (
    <Section>
      <div className="mx-auto max-w-6xl">
        <header className="mb-12 mx-auto text-center">
          <h1 className="text-3xl font-black tracking-tighter text-body sm:text-5xl">
            {t.blogs}
          </h1>
          <p className="mt-4 text-base text-paragraph md:text-lg">
            {t.description}
          </p>
        </header>

        {/* Featured: the two newest posts side by side at 50% / 50%. */}
        <div className="grid grid-cols-1 sm:grid-cols-2">
          {featured.map((post) => (
            <div key={post.path} className="border-b border-r border-subtle">
              <PostCard
                post={post}
                href={`site:${post.path}`}
                locale={locale}
                featured
                base={config.base}
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3">
          {restPosts.map((post) => (
            <div key={post.path} className="border-b border-r border-subtle">
              <PostCard
                post={post}
                href={`site:${post.path}`}
                locale={locale}
                base={config.base}
              />
            </div>
          ))}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex flex-row items-center justify-center gap-4 text-sm">
          {page > 1 && (
            <Button
              variant="outline"
              size="md"
              onPress={() => setPage(page - 1)}
            >
              <ArrowLeft className="size-4" />
              {t.previous}
            </Button>
          )}
          <span className="text-paragraph">
            {t.pageof
              .replace('{page}', String(page))
              .replace('{totalPages}', String(totalPages))}
          </span>
          {page < totalPages && (
            <Button
              variant="outline"
              size="md"
              onPress={() => setPage(page + 1)}
            >
              {t.next}
              <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      )}
    </Section>
  )
}
