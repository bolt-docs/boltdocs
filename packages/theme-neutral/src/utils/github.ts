const BASE_URL = 'https://api.github.com'

/**
 * Get the number of stars for a GitHub repository.
 * @param repo - owner/repo
 * @param token - The GitHub token.
 * @param baseUrl - The GitHub API base URL.
 * @returns The number of stars for the repository.
 * @example
 * getStarsRepo('owner/repo') // 100k
 */
export async function getStarsRepo(
  repo: string,
  token?: string,
  baseUrl: string = BASE_URL,
) {
  const headers = new Headers()
  if (token) {
    headers.append('authorization', token)
  }
  const response = await fetch(`${baseUrl}/repos/${repo}`, {
    headers,
  })
  const data = await response.json()
  if (data.stargazers_count !== undefined) {
    return formatStars(data.stargazers_count)
  } else {
    return '0' // Fallback
  }
}

/**
 * Format a number of stars in a compact form.
 * @param count - The number of stars to format.
 * @returns The formatted number of stars.
 */
const formatStars = (count: number): string => {
  return Intl.NumberFormat('en', {
    notation: 'compact',
    compactDisplay: 'short',
  }).format(count)
}

interface GetGithubLastCommitOptions {
  repo: string
  token?: string
  owner: string
  path: string
  sha?: string
  baseUrl?: string
  options?: RequestInit
  params?: Record<string, string>
  parser?: (data: ResponseLastCommit[0]) => string
}

type ResponseLastCommit = {
  sha: string
  commit: {
    committer: {
      date: string
    }
  }
}[]

const parserDefault = (data: ResponseLastCommit[0]) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(data.commit.committer.date))
}

export async function getGithubLastEdit({
  repo,
  token,
  owner,
  path,
  sha,
  baseUrl = BASE_URL,
  options = {},
  params: customParams = {},
  parser = parserDefault,
}: GetGithubLastCommitOptions): Promise<string | null> {
  const headers = new Headers(options.headers)
  const params = new URLSearchParams()
  params.set('path', path)
  params.set('page', '1')
  params.set('per_page', '1')

  if (sha) params.set('sha', sha)

  for (const [key, value] of Object.entries(customParams)) {
    params.set(key, value)
  }

  if (token) {
    headers.append('authorization', token)
  }

  const res = await fetch(
    `${baseUrl}/repos/${owner}/${repo}/commits?${params.toString()}`,
    {
      ...options,
      headers,
    },
  )

  if (!res.ok) throw new Error(`Github API error ${await res.text()}`)
  const data = (await res.json()) as ResponseLastCommit

  const lastCommit = data[0]

  // Validation Internal
  if (!lastCommit.commit.committer.date) {
    console.warn('Commit found but no date available')
    return null
  }

  if (data.length === 0) return null
  return parser(lastCommit)
}
