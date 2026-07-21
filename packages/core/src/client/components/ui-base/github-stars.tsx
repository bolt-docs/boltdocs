import { useEffect, useState } from 'react'
import { getStarsRepo } from '../../utils/github'
import { Github } from '../icons-prod'

export function GithubStars({ repo }: { repo: string }) {
  const [stars, setStars] = useState<string | null>(null)

  useEffect(() => {
    if (repo) {
      getStarsRepo(repo)
        .then((stars) => setStars(stars))
        .catch(() => setStars('0'))
    }
  }, [repo])

  return (
    <a
      href={`https://github.com/${repo}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-xl border border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-muted dark:hover:bg-primary-300/50 hover:bg-primary-200/50 transition-colors duration-100 hover:border-primary-500/50 hover:text-body select-none outline-none"
    >
      <Github className="h-4 w-4 text-body" />
      {stars !== null && (
        <span className="tabular-nums font-medium">{stars} stars</span>
      )}
    </a>
  )
}
