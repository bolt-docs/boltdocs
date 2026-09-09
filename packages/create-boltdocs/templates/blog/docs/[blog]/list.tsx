import { usePosts } from 'boltdocs/client'

export default function BlogList() {
  const posts = usePosts('blog')

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <h1 className="text-3xl font-bold mb-8">Blog</h1>

      <div className="space-y-8">
        {posts.map((post) => (
          <article
            key={post.path}
            className="border-b border-neutral-200 dark:border-neutral-800 pb-6"
          >
            <h2 className="text-xl font-semibold mb-2">
              <a href={post.path} className="text-primary-600 hover:underline">
                {post.title}
              </a>
            </h2>

            {post.date && (
              <time className="text-sm text-neutral-500 dark:text-neutral-400 block mb-2">
                {new Date(post.date).toLocaleDateString()}
              </time>
            )}

            {post.excerpt && (
              <p className="text-neutral-600 dark:text-neutral-300">
                {post.excerpt}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
