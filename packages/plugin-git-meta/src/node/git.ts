import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const MAX_BUFFER = 64 * 1024 * 1024
const MARKDOWN_FILE = /\.(?:md|mdx)$/i
const RECORD_SEPARATOR = '\x1e'
const FIELD_SEPARATOR = '\x1f'

export interface GitAuthor {
  name: string
  email: string
}

export interface GitCommitInfo {
  hash: string
  /** ISO-8601 committer date. */
  date: string
  author: GitAuthor
}

export interface GitContributor {
  author: GitAuthor
  commits: number
  /** ISO-8601 date of the contributor's most recent commit on the file. */
  lastCommit: string
}

export interface GitFileHistory {
  lastCommit: GitCommitInfo
  contributors: GitContributor[]
}

export interface GitHistory {
  /** False when the docs directory is not inside a readable git repository. */
  available: boolean
  repoRoot?: string
  head?: string
  /** Absolute file path → aggregated history. */
  files: Map<string, GitFileHistory>
  reason?: string
}

interface RawCommit {
  hash: string
  date: string
  author: GitAuthor
  files: string[]
}

interface MutableFileHistory {
  lastCommit: GitCommitInfo
  contributors: Map<string, GitContributor>
}

const repoRootCache = new Map<string, Promise<string | null>>()
const historyCache = new Map<string, Promise<GitHistory>>()

async function runGit(
  args: string[],
  cwd: string,
): Promise<{ stdout: string }> {
  const result = await execFileAsync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    windowsHide: true,
  })
  return { stdout: result.stdout }
}

export function clearGitHistoryCache(): void {
  repoRootCache.clear()
  historyCache.clear()
}

async function findRepoRoot(startDir: string): Promise<string | null> {
  const cached = repoRootCache.get(startDir)
  if (cached) return cached

  const promise = (async () => {
    try {
      const { stdout } = await runGit(
        ['rev-parse', '--show-toplevel'],
        startDir,
      )
      return stdout.trim() || null
    } catch {
      return null
    }
  })()

  repoRootCache.set(startDir, promise)
  return promise
}

function commitTimestamp(date: string): number {
  const timestamp = new Date(date).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function parseHeader(header: string): GitCommitInfo | null {
  const [hash, date, name, email] = header.split(FIELD_SEPARATOR)
  if (!hash || !date || !name) return null
  const parsedDate = new Date(date)
  return {
    hash,
    date: Number.isNaN(parsedDate.getTime()) ? date : parsedDate.toISOString(),
    author: { name, email: email ?? '' },
  }
}

/**
 * Parses `git log -z --name-only` output.
 *
 * Records start with `\x1e`, fields are separated by `\x1f` and the NUL
 * separators introduced by `-z` delimit every path. Paths outside the
 * supported markdown extensions are ignored, and identities are aggregated
 * by lower-cased email.
 */
export function parseGitLog(
  output: string,
  repoRoot: string,
): Map<string, GitFileHistory> {
  const files = new Map<string, MutableFileHistory>()
  let current: RawCommit | null = null

  const flush = () => {
    if (!current) return
    const commit: GitCommitInfo = {
      hash: current.hash,
      date: current.date,
      author: current.author,
    }

    for (const file of current.files) {
      if (!MARKDOWN_FILE.test(file)) continue
      const absolute = path.resolve(repoRoot, file)
      const existing = files.get(absolute) ?? {
        lastCommit: commit,
        contributors: new Map<string, GitContributor>(),
      }

      if (
        commitTimestamp(commit.date) > commitTimestamp(existing.lastCommit.date)
      ) {
        existing.lastCommit = commit
      }

      const key = commit.author.email.toLowerCase() || commit.author.name
      const contributor = existing.contributors.get(key)
      if (contributor) {
        contributor.commits += 1
        if (
          commitTimestamp(commit.date) > commitTimestamp(contributor.lastCommit)
        ) {
          contributor.lastCommit = commit.date
        }
      } else {
        existing.contributors.set(key, {
          author: commit.author,
          commits: 1,
          lastCommit: commit.date,
        })
      }

      files.set(absolute, existing)
    }
  }

  for (const rawToken of output.split('\0')) {
    const token = rawToken.replace(/^\n+/, '').replace(/\n+$/, '')
    if (!token) continue

    const recordIndex = token.indexOf(RECORD_SEPARATOR)
    if (recordIndex !== -1) {
      flush()
      current = null
      const header = parseHeader(token.slice(recordIndex + 1))
      if (header) {
        current = {
          hash: header.hash,
          date: header.date,
          author: header.author,
          files: [],
        }
      }
      continue
    }

    if (current) current.files.push(token)
  }

  flush()

  const result = new Map<string, GitFileHistory>()
  for (const [file, history] of files) {
    const contributors = [...history.contributors.values()].sort(
      (left, right) =>
        right.commits - left.commits ||
        commitTimestamp(right.lastCommit) - commitTimestamp(left.lastCommit) ||
        left.author.name.localeCompare(right.author.name),
    )
    result.set(file, { lastCommit: history.lastCommit, contributors })
  }
  return result
}

async function scanHistory(
  repoRoot: string,
  docsDir: string,
  head: string,
): Promise<GitHistory> {
  const relativeDocs = path.relative(repoRoot, docsDir).replace(/\\/g, '/')
  const pathspec =
    !relativeDocs || relativeDocs.startsWith('..') ? '.' : relativeDocs

  try {
    const { stdout } = await runGit(
      [
        '-c',
        'core.quotePath=false',
        'log',
        '-z',
        '--no-merges',
        '--date-order',
        `--format=${RECORD_SEPARATOR}%H${FIELD_SEPARATOR}%cI${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%ae`,
        '--name-only',
        '--',
        pathspec,
      ],
      repoRoot,
    )

    return {
      available: true,
      repoRoot,
      head,
      files: parseGitLog(stdout, repoRoot),
    }
  } catch (error) {
    return {
      available: false,
      repoRoot,
      head,
      files: new Map(),
      reason: error instanceof Error ? error.message : 'git-log-failed',
    }
  }
}

/**
 * Returns the git history for every markdown file under `startDir`.
 *
 * The scan is cached per repository + HEAD, so the last-updated and
 * contributors plugins share a single `git log` process per build. Caching by
 * HEAD also makes dev servers pick up new commits without a restart.
 */
export async function getGitHistory(startDir: string): Promise<GitHistory> {
  const repoRoot = await findRepoRoot(startDir)
  if (!repoRoot) {
    return {
      available: false,
      files: new Map(),
      reason: 'not-a-git-repository',
    }
  }

  let head = ''
  try {
    head = (await runGit(['rev-parse', 'HEAD'], repoRoot)).stdout.trim()
  } catch {
    return {
      available: false,
      repoRoot,
      files: new Map(),
      reason: 'empty-repository',
    }
  }

  const cacheKey = `${repoRoot}\0${path.resolve(startDir)}\0${head}`
  const cached = historyCache.get(cacheKey)
  if (cached) return cached

  const promise = scanHistory(repoRoot, startDir, head)
  historyCache.set(cacheKey, promise)
  return promise
}
