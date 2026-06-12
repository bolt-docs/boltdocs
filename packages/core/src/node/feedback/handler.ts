import { submitGitHubFeedback } from './github'
import * as z from 'zod'

export interface FeedbackHandlerOptions {
  owner?: string
  repo?: string
  categorySlug?: string
  token?: string
  appId?: string
  privateKey?: string
  installationId?: string
}

const PayloadSchema = z.object({
  rating: z.enum(['good', 'neutral', 'bad']),
  path: z.string(),
  title: z.string(),
  comment: z.string().optional(),
})

export async function handleFeedback(
  payload: unknown,
  env: Record<string, string | undefined> = process.env,
  options: FeedbackHandlerOptions = {},
): Promise<{ success: boolean }> {
  const result = PayloadSchema.safeParse(payload)

  if (!result.success) {
    throw new Error('Invalid feedback payload')
  }

  const payloadRequest = result.data

  const owner =
    options.owner || env.GITHUB_REPO_OWNER || env.BOLTDOCS_GITHUB_REPO_OWNER
  const repo =
    options.repo || env.GITHUB_REPO_NAME || env.BOLTDOCS_GITHUB_REPO_NAME
  const categorySlug =
    options.categorySlug ||
    env.GITHUB_DISCUSSION_CATEGORY ||
    env.BOLTDOCS_GITHUB_DISCUSSION_CATEGORY ||
    'general'

  const token = options.token || env.BOLTDOCS_GITHUB_TOKEN || env.GITHUB_TOKEN
  const appId = options.appId || env.GITHUB_APP_ID
  const privateKey = options.privateKey || env.GITHUB_PRIVATE_KEY
  const installationId = options.installationId || env.GITHUB_INSTALLATION_ID

  if (!owner || !repo) {
    throw new Error(
      'GitHub repository coordinates (owner and repo name) are missing. Please set GITHUB_REPO_OWNER and GITHUB_REPO_NAME.',
    )
  }

  await submitGitHubFeedback(payloadRequest, {
    owner,
    repo,
    categorySlug,
    token,
    appId,
    privateKey,
    installationId,
  })

  return { success: true }
}
