import { useState } from 'react'
import { useI18n, usePosts } from 'boltdocs/client'
import { Button, Link } from 'boltdocs/primitives'

const translations = {
  es: {
    blogs: 'Blogs',
    previous: 'Anterior',
    next: 'Siguiente',
    pageof: 'Página {page} de {totalPages}',
  },
  en: {
    blogs: 'Blogs',
    previous: 'Previous',
    next: 'Next',
    pageof: 'Page {page} of {totalPages}',
  },
}

export default function BlogList() {
  const allPosts = usePosts()
  const { currentLocale } = useI18n()
  const [page, setPage] = useState(1)
  const perPage = 20
  const posts = allPosts.slice((page - 1) * perPage, page * perPage)
  const totalPages = Math.ceil(allPosts.length / perPage)

  const t = translations[currentLocale] || translations.en

  return (
    <div className="py-8 max-w-2xl mx-auto px-4">
      <h1 className="text-3xl font-bold mb-6">{t.blogs}</h1>

      <ul className="flex flex-col gap-28">
        {posts.map((post) => (
          <Link
            key={post.path}
            href={`site:${post.path}`}
            className="flex flex-row"
          >
            <div className="w-[25%] border-r border-r-subtle px-2">
              {post.date && (
                <time className="text-xs text-muted block mb-2">
                  {new Date(post.date).toLocaleDateString(currentLocale, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </time>
              )}
              <ul className="flex flex-row flex-wrap gap-2">
                {post.tags?.map((tag, index) => (
                  <li
                    className="px-2 py-1 text-xs border-subtle rounded-md border"
                    key={`${tag}-${index}`}
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            </div>
            <div className="w-[75%] px-5">
              <img
                src={post.coverImage}
                alt={post.title}
                className="w-full h-auto mb-4"
              />
              <h2 className="text-xl font-semibold mb-2">{post.title}</h2>

              {post.excerpt && (
                <p className="text-sm text-body/70">{post.excerpt}</p>
              )}
            </div>
          </Link>
        ))}
      </ul>

      {totalPages > 1 && (
        <div className="mt-20 flex flex-row items-center gap-4 text-sm">
          {page > 1 && (
            <Button
              onClick={() => setPage(page - 1)}
              className="text-primary-600 border-subtle rounded-md border px-3 py-1 hover:cursor-pointer"
            >
              {t.previous}
            </Button>
          )}
          <span>
            {t.pageof
              .replace('{page}', page)
              .replace('{totalPages}', totalPages)}
          </span>
          {page < totalPages && (
            <Button
              className="text-primary-600 border-subtle rounded-md border px-3 py-1 hover:cursor-pointer"
              onClick={() => setPage(page + 1)}
            >
              {t.next}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
