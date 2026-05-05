import { useEffect, useState } from 'react'
import { getStarsRepo } from '../../utils/github'
import { Github } from '../icons-dev'

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
      className="inline-flex items-center gap-2 rounded-md border border-subtle bg-surface px-2.5 py-1.5 text-xs font-medium text-muted transition-all hover:bg-main hover:border-strong hover:text-body"
    >
      <Github className="h-4 w-4" />
      {stars && <span className="tabular-nums">{stars}</span>}
    </a>
  )
}
