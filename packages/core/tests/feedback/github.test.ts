import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateGitHubAppJWT,
  getInstallationAccessToken,
  queryGitHubGraphQL,
  submitGitHubFeedback,
} from '../../src/node/feedback/github'
import crypto from 'node:crypto'

// Generate a dummy RSA private key for testing JWT signing
const { privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

describe('GitHub Discussions Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  describe('generateGitHubAppJWT', () => {
    it('should generate a valid JWT format with 3 base64url parts', () => {
      const jwt = generateGitHubAppJWT('12345', privateKey)
      const parts = jwt.split('.')
      expect(parts).toHaveLength(3)

      // Verify header
      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString())
      expect(header).toEqual({ alg: 'RS256', typ: 'JWT' })

      // Verify payload
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
      expect(payload.iss).toBe('12345')
      expect(payload.exp - payload.iat).toBe(660) // 10 minutes lifetime + 60s skew
    })
  })

  describe('getInstallationAccessToken', () => {
    it('should fetch installation access token and return token string', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token: 'mock-installation-token' }),
      })
      vi.stubGlobal('fetch', mockFetch)

      const token = await getInstallationAccessToken(
        '12345',
        privateKey,
        '99999',
      )
      expect(token).toBe('mock-installation-token')
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/app/installations/99999/access_tokens',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Accept: 'application/vnd.github+json',
            'User-Agent': 'Boltdocs-Feedback',
          }),
        }),
      )
    })

    it('should throw error when fetch is not ok', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
          status: 401,
          text: async () => 'Unauthorized access',
        }),
      )

      await expect(
        getInstallationAccessToken('12345', privateKey, '99999'),
      ).rejects.toThrow(
        'Failed to get installation access token: 401 Unauthorized access',
      )
    })
  })

  describe('queryGitHubGraphQL', () => {
    it('should successfully execute a GraphQL query and return data', async () => {
      const mockResponse = { data: { viewer: { login: 'octocat' } } }
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => mockResponse,
        }),
      )

      const data = await queryGitHubGraphQL(
        'dummy-token',
        '{ viewer { login } }',
      )
      expect(data).toEqual({ viewer: { login: 'octocat' } })
    })

    it('should throw when query contains errors', async () => {
      const mockResponse = {
        errors: [{ message: 'Field "viewer" does not exist' }],
      }
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => mockResponse,
        }),
      )

      await expect(
        queryGitHubGraphQL('dummy-token', '{ viewer { login } }'),
      ).rejects.toThrow('GitHub GraphQL Error: Field "viewer" does not exist')
    })
  })

  describe('submitGitHubFeedback', () => {
    const mockRepoData = {
      repository: {
        id: 'repo-node-id',
        discussionCategory: {
          id: 'category-node-id',
        },
      },
    }

    const payload = {
      rating: 'good' as const,
      comment: 'This page was amazing!',
      path: '/docs/intro',
      title: 'Introduction',
    }

    it('should add comment directly if matching discussion exists', async () => {
      const searchResponse = {
        search: {
          nodes: [
            {
              id: 'discussion-node-id',
              title: '[Feedback] /docs/intro',
            },
          ],
        },
      }

      const commentResponse = {
        addDiscussionComment: {
          comment: {
            id: 'comment-node-id',
          },
        },
      }

      // Mock fetch requests sequentially
      let requestCount = 0
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => {
          requestCount++
          let responseData = {}
          if (requestCount === 1) {
            responseData = { data: mockRepoData }
          } else if (requestCount === 2) {
            responseData = { data: searchResponse }
          } else if (requestCount === 3) {
            responseData = { data: commentResponse }
          }
          return {
            ok: true,
            json: async () => responseData,
          }
        }),
      )

      const result = await submitGitHubFeedback(payload, {
        owner: 'testowner',
        repo: 'testrepo',
        token: 'test-token',
      })

      expect(result).toEqual({ success: true })
      expect(requestCount).toBe(3) // 1. Repo lookup, 2. Search, 3. Add comment
    })

    it('should create a new discussion thread and then comment if no match exists', async () => {
      const searchResponseNoMatch = {
        search: {
          nodes: [],
        },
      }

      const createDiscussionResponse = {
        createDiscussion: {
          discussion: {
            id: 'new-discussion-node-id',
          },
        },
      }

      const commentResponse = {
        addDiscussionComment: {
          comment: {
            id: 'comment-node-id',
          },
        },
      }

      let requestCount = 0
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async () => {
          requestCount++
          let responseData = {}
          if (requestCount === 1) {
            responseData = { data: mockRepoData }
          } else if (requestCount === 2) {
            responseData = { data: searchResponseNoMatch }
          } else if (requestCount === 3) {
            responseData = { data: createDiscussionResponse }
          } else if (requestCount === 4) {
            responseData = { data: commentResponse }
          }
          return {
            ok: true,
            json: async () => responseData,
          }
        }),
      )

      const result = await submitGitHubFeedback(payload, {
        owner: 'testowner',
        repo: 'testrepo',
        token: 'test-token',
      })

      expect(result).toEqual({ success: true })
      expect(requestCount).toBe(4) // 1. Repo lookup, 2. Search, 3. Create discussion, 4. Add comment
    })

    it('should throw error if repository is not found', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            data: {
              repository: null,
            },
          }),
        }),
      )

      await expect(
        submitGitHubFeedback(payload, {
          owner: 'testowner',
          repo: 'not-exist-repo',
          token: 'test-token',
        }),
      ).rejects.toThrow('Repository not found: testowner/not-exist-repo')
    })

    it('should throw error if discussion category slug is not found', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            data: {
              repository: {
                id: 'repo-id',
                discussionCategory: null,
              },
            },
          }),
        }),
      )

      await expect(
        submitGitHubFeedback(payload, {
          owner: 'testowner',
          repo: 'testrepo',
          token: 'test-token',
          categorySlug: 'non-existing-category',
        }),
      ).rejects.toThrow(
        'Discussion category slug "non-existing-category" not found in testowner/testrepo',
      )
    })

    it('should throw error if no authentication credentials are provided', async () => {
      await expect(
        submitGitHubFeedback(payload, {
          owner: 'testowner',
          repo: 'testrepo',
        }),
      ).rejects.toThrow('GitHub authentication credentials missing')
    })

    it('should exchange JWT and fetch installation token if GITHUB_APP_* parameters are used', async () => {
      const searchResponse = {
        search: {
          nodes: [
            {
              id: 'discussion-node-id',
              title: '[Feedback] /docs/intro',
            },
          ],
        },
      }

      const commentResponse = {
        addDiscussionComment: {
          comment: {
            id: 'comment-node-id',
          },
        },
      }

      let requestCount = 0
      vi.stubGlobal(
        'fetch',
        vi.fn().mockImplementation(async (url) => {
          requestCount++
          let responseData = {}
          if (url.includes('access_tokens')) {
            responseData = { token: 'jwt-exchanged-token' }
          } else if (requestCount === 2) {
            responseData = { data: mockRepoData }
          } else if (requestCount === 3) {
            responseData = { data: searchResponse }
          } else if (requestCount === 4) {
            responseData = { data: commentResponse }
          }
          return {
            ok: true,
            json: async () => responseData,
          }
        }),
      )

      const result = await submitGitHubFeedback(payload, {
        owner: 'testowner',
        repo: 'testrepo',
        appId: '123',
        privateKey,
        installationId: '456',
      })

      expect(result).toEqual({ success: true })
      expect(requestCount).toBe(4) // 1. Exchange token, 2. Repo lookup, 3. Search, 4. Add comment
    })
  })
})
