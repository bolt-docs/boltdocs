import { Link } from 'react-router-dom'
import { useRecentPosts } from 'boltdocs/client'
import { useTranslations } from '../../i18n/index'

export function FeaturedResources() {
  const recentPosts = useRecentPosts('blog', 3)
  const t = useTranslations()

  return (
    <section className="py-24 px-6 relative border-t border-white/5 bg-main/40">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="max-w-xl">
            <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-body mb-4">
              {t.featuredTitle}
            </h2>
          </div>
          <Link
            to="/blog"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-6 text-sm font-medium"
          >
            {t.featuredAll}
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {recentPosts.map((post) => {
            const { title, cover } = post.frontmatter

            return (
              <Link
                key={post.path}
                to={post.path}
                className="relative flex flex-col overflow-hidden rounded-2xl border border-white/10 dark:bg-neutral-950 bg-neutral-50"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-neutral-900">
                  {cover ? (
                    <img
                      src={cover as string}
                      alt={title as string}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <div className="w-full h-full bg-linear-to-br from-indigo-500/20 to-purple-500/20" />
                  )}
                </div>
                <div className="flex flex-col p-6">
                  <div className="text-[10px] font-mono tracking-widest text-body/50 uppercase mb-3">
                    {'// UPDATES'}
                  </div>
                  <h3 className="text-xl font-bold tracking-tight text-body line-clamp-2">
                    {title as string}
                  </h3>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
