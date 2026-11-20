import crypto from 'node:crypto'

export interface FeedbackPayload {
  rating: 'good' | 'neutral' | 'bad'
  comment?: string
  path: string
  title: string
  blockId?: string
}

export interface GitHubFeedbackOptions {
  owner: string
  repo: string
  categorySlug?: string
  token?: string
  appId?: string
  privateKey?: string
  installationId?: string
}

export function generateGitHubAppJWT(
  appId: string,
  privateKey: string,
): string {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  }
  const now = Math.floor(Date.now() / 1000)
  const payload = {
    iat: now - 60,
    exp: now + 10 * 60,
    iss: appId,
  }

  const base64Encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')

  const encodedHeader = base64Encode(header)
  const encodedPayload = base64Encode(payload)

  const sign = crypto.createSign('RSA-SHA256')
  sign.update(`${encodedHeader}.${encodedPayload}`)

  const formattedKey = privateKey.replace(/\\n/g, '\n')
  const signature = sign.sign(formattedKey, 'base64')

  return `${encodedHeader}.${encodedPayload}.${signature}`
}

export async function getInstallationAccessToken(
  appId: string,
  privateKey: string,
  installationId: string,
): Promise<string> {
  const jwt = generateGitHubAppJWT(appId, privateKey)
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Boltdocs-Feedback',
      },
    },
  )
  if (!res.ok) {
    const text = await res.text()
    throw new Error(
      `Failed to get installation access token: ${res.status} ${text}`,
    )
  }
  const data = (await res.json()) as { token: string }
  return data.token
}

export async function queryGitHubGraphQL<T>(
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Boltdocs-Feedback',
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GitHub GraphQL API error: ${res.status} ${text}`)
  }

  const result = (await res.json()) as {
    data?: T
    errors?: Array<{ message: string }>
  }
  if (result.errors?.length) {
    const messages = result.errors.map((e) => e.message).join(', ')
    throw new Error(`GitHub GraphQL Error: ${messages}`)
  }

  return result.data as T
}

export async function submitGitHubFeedback(
  payload: FeedbackPayload,
  options: GitHubFeedbackOptions,
): Promise<{ success: boolean }> {
  let token = options.token

  if (!token) {
    if (options.appId && options.privateKey && options.installationId) {
      token = await getInstallationAccessToken(
        options.appId,
        options.privateKey,
        options.installationId,
      )
    } else {
      throw new Error(
        'GitHub authentication credentials missing. Provide GITHUB_TOKEN or GITHUB_APP_* variables.',
      )
    }
  }

  const { owner, repo, categorySlug = 'general' } = options
  const { rating, comment, path, title, blockId } = payload

  const repoData = await queryGitHubGraphQL<any>(
    token,
    `query GetRepoAndCategory($owner: String!, $name: String!, $categorySlug: String!) {
      repository(owner: $owner, name: $name) {
        id
        discussionCategory(slug: $categorySlug) { id }
      }
    }`,
    { owner, name: repo, categorySlug },
  )

  if (!repoData?.repository) {
    throw new Error(`Repository not found: ${owner}/${repo}`)
  }

  const repositoryId = repoData.repository.id
  const categoryId = repoData.repository.discussionCategory?.id

  if (!categoryId) {
    throw new Error(
      `Discussion category slug "${categorySlug}" not found in ${owner}/${repo}`,
    )
  }

  const expectedTitle = `[Feedback] ${path}`
  const searchData = await queryGitHubGraphQL<any>(
    token,
    `query FindDiscussion($searchQuery: String!) {
      search(query: $searchQuery, type: DISCUSSION, first: 10) {
        nodes {
          ... on Discussion { id title }
        }
      }
    }`,
    { searchQuery: `repo:${owner}/${repo} in:title "${expectedTitle}"` },
  )

  const nodes = searchData?.search?.nodes || []
  const matchingNode = nodes.find((node: any) => node.title === expectedTitle)
  let discussionId = matchingNode?.id

  if (!discussionId) {
    const createData = await queryGitHubGraphQL<any>(
      token,
      `mutation CreateDiscussion($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
        createDiscussion(input: {repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body}) {
          discussion { id }
        }
      }`,
      {
        repositoryId,
        categoryId,
        title: expectedTitle,
        body: `This discussion thread holds feedback comments for page: [${title}](${path}).`,
      },
    )
    discussionId = createData?.createDiscussion?.discussion?.id
  }

  if (!discussionId) {
    throw new Error('Failed to resolve or create discussion thread.')
  }

  const ratingEmojis = { good: '😊 GOOD', neutral: '😐 NEUTRAL', bad: '🙁 BAD' }

  const commentLines = [
    blockId ? `### Code Block Feedback` : `### Page Feedback`,
    `- **Page:** [${title}](${path})`,
    `- **Rating:** ${ratingEmojis[rating]}`,
    blockId ? `- **Block:** ${blockId}` : '',
    comment ? `\n**Comment:**\n${comment}` : '\n_No comments provided._',
  ]

  await queryGitHubGraphQL(
    token,
    `mutation AddComment($discussionId: ID!, $body: String!) {
      addDiscussionComment(input: {discussionId: $discussionId, body: $body}) {
        comment { id }
      }
    }`,
    { discussionId, body: commentLines.filter(Boolean).join('\n') },
  )

  return { success: true }
}
