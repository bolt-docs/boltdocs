import { z } from 'zod'
import {
  createPlugin,
  type BoltdocsPlugin,
  type RouteContributor,
} from 'boltdocs'
import { getGitHistory, type GitContributor } from './git'
import { matchesRoutePath, routeFilePath } from './filters'

const ProfileSchema = z.object({
  name: z.string().min(1).optional(),
  avatar: z.string().url().optional(),
  url: z.string().url().optional(),
})

export const ContributorsOptionsSchema = z.object({
  /** Maximum number of contributors stored per page. */
  max: z.number().int().min(1).max(100).default(12),
  /** `commits` ranks by total commits, `recent` by latest contribution. */
  order: z.enum(['commits', 'recent']).default('commits'),
  /** Drop automation accounts such as dependabot and github-actions. */
  excludeBots: z.boolean().default(true),
  /** Names or emails to exclude from the contributor list. */
  excludeAuthors: z.array(z.string().min(1)).default([]),
  /** Ignore contributors below this commit count. */
  minCommits: z.number().int().min(1).default(1),
  /** Combine identities that share the same display name. */
  mergeByName: z.boolean().default(true),
  /** Include the author email in the route metadata (off by default). */
  includeEmail: z.boolean().default(false),
  /**
   * Mount the exported `Contributors` component on the left side of the
   * default page footer. Disable it when rendering the component yourself.
   */
  autoRender: z.boolean().default(true),
  /**
   * Per-identity overrides keyed by email or display name. Useful to pin a
   * GitHub avatar for authors whose commits use a personal email address.
   */
  profiles: z.record(z.string(), ProfileSchema).default({}),
  /** Only process routes whose path starts with one of these prefixes. */
  paths: z.array(z.string().min(1)).optional(),
  /** Skip routes whose path starts with one of these prefixes. */
  excludePaths: z.array(z.string().min(1)).optional(),
})

export type ContributorsOptions = z.input<typeof ContributorsOptionsSchema>

type Profile = z.output<typeof ProfileSchema>

const BOT_PATTERN =
  /(?:\[bot\]|dependabot|renovate|github-actions|semantic-release-bot|greenkeeper|snyk-bot|copilot-swe-agent)/i
const GITHUB_NOREPLY = /^(?:\d+\+)?([^@+]+)@users\.noreply\.github\.com$/i

function githubUsername(email: string): string | null {
  const match = GITHUB_NOREPLY.exec(email.trim())
  return match?.[1] ?? null
}

function isBot(name: string, email: string): boolean {
  return BOT_PATTERN.test(name) || BOT_PATTERN.test(email)
}

function commitTimestamp(date: string | undefined): number {
  if (!date) return 0
  const timestamp = new Date(date).getTime()
  return Number.isFinite(timestamp) ? timestamp : 0
}

function buildProfileLookup(
  profiles: Record<string, Profile>,
): Map<string, Profile> {
  return new Map(
    Object.entries(profiles).map(([key, profile]) => [
      key.trim().toLowerCase(),
      profile,
    ]),
  )
}

function findProfile(
  lookup: Map<string, Profile>,
  name: string,
  email: string,
): Profile | undefined {
  return lookup.get(email.toLowerCase()) ?? lookup.get(name.toLowerCase())
}

interface Candidate extends RouteContributor {
  email?: string
}

function mergeCandidates(candidates: Candidate[]): Candidate[] {
  const merged = new Map<string, Candidate>()

  for (const candidate of candidates) {
    const key = candidate.name.trim().toLowerCase()
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, { ...candidate })
      continue
    }

    existing.commits += candidate.commits
    if (
      commitTimestamp(candidate.lastCommit) >
      commitTimestamp(existing.lastCommit)
    ) {
      existing.lastCommit = candidate.lastCommit
    }
    existing.avatar ??= candidate.avatar
    existing.url ??= candidate.url
    if (candidate.email) existing.email = candidate.email
  }

  return [...merged.values()]
}

function toCandidate(
  contributor: GitContributor,
  lookup: Map<string, Profile>,
): Candidate {
  const author = contributor.author
  const profile = findProfile(lookup, author.name, author.email)
  const username = githubUsername(author.email)

  return {
    name: profile?.name ?? author.name,
    email: author.email,
    avatar:
      profile?.avatar ??
      (username ? `https://github.com/${username}.png?size=64` : undefined),
    url:
      profile?.url ?? (username ? `https://github.com/${username}` : undefined),
    commits: contributor.commits,
    lastCommit: contributor.lastCommit,
  }
}

function isExcluded(candidate: Candidate, excluded: Set<string>): boolean {
  return (
    excluded.has(candidate.name.toLowerCase()) ||
    excluded.has((candidate.email ?? '').toLowerCase())
  )
}

function sortCandidates(
  candidates: Candidate[],
  order: 'commits' | 'recent',
): Candidate[] {
  return candidates.sort((left, right) => {
    if (order === 'recent') {
      const recent =
        commitTimestamp(right.lastCommit) - commitTimestamp(left.lastCommit)
      if (recent !== 0) return recent
    }
    return (
      right.commits - left.commits ||
      commitTimestamp(right.lastCommit) - commitTimestamp(left.lastCommit) ||
      left.name.localeCompare(right.name)
    )
  })
}

function stripEmail(
  candidate: Candidate,
  includeEmail: boolean,
): RouteContributor {
  if (!includeEmail) delete candidate.email
  return candidate
}

/**
 * `@bdocs/plugin-git-meta` — contributor lists sourced from git.
 *
 * Every contributor is ranked by the number of commits that touched the page.
 * GitHub noreply identities automatically get an avatar and profile URL;
 * other authors can be mapped through the `profiles` option. Emails are not
 * exposed unless `includeEmail` is enabled.
 */
export function contributorsPlugin(
  rawOptions: ContributorsOptions = {},
): BoltdocsPlugin {
  const options = ContributorsOptionsSchema.parse(rawOptions)
  const lookup = buildProfileLookup(options.profiles)
  const excluded = new Set(
    options.excludeAuthors.map((author) => author.trim().toLowerCase()),
  )

  return createPlugin({
    name: 'boltdocs-plugin-contributors',
    version: '0.1.0',
    client: options.autoRender
      ? {
          slots: {
            'page:footer:start':
              '@bdocs/plugin-git-meta/client#ContributorsSlot',
          },
        }
      : undefined,
    hooks: {
      async 'routes:resolved'(ctx, { routes }) {
        const history = await getGitHistory(ctx.docsDir)
        if (!history.available) {
          ctx.logger.debug(
            `[contributors] git history unavailable (${history.reason ?? 'unknown'}); skipping contributor metadata.`,
          )
          return routes
        }

        for (const route of routes) {
          if (!matchesRoutePath(route.path, options)) continue

          const entry = history.files.get(routeFilePath(route, ctx.docsDir))
          if (!entry) continue

          let candidates = entry.contributors
            .filter(
              (contributor) =>
                !(
                  options.excludeBots &&
                  isBot(contributor.author.name, contributor.author.email)
                ),
            )
            .map((contributor) => toCandidate(contributor, lookup))
            .filter((candidate) => candidate.commits >= options.minCommits)
            .filter((candidate) => !isExcluded(candidate, excluded))

          if (options.mergeByName) candidates = mergeCandidates(candidates)

          const contributors = sortCandidates(candidates, options.order)
            .slice(0, options.max)
            .map((candidate) => stripEmail(candidate, options.includeEmail))

          route.contributors =
            contributors.length > 0 ? contributors : undefined
        }

        return routes
      },
    },
  }) as BoltdocsPlugin
}
