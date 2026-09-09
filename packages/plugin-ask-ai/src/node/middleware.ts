import path from 'node:path'
import type { ServerResponse } from 'node:http'
import type { Connect } from 'vite'
import { warn } from '@bdocs/dui'
import { headers } from '../server/adapters/headers'
import { resolvePageContext } from './context'
import { checkInputSafety } from './safety'
import { getClientIp, rateLimit } from './rate-limit'
import type { Provider } from './options'

interface AskAiRequest {
  question?: string
  currentPage?: string
  context?: { page: string; content: string }
}

export interface MiddlewareConfig {
  provider: Provider
  model: string
  endpoint: string
  systemPrompt: string
  maxInputChars: number
  maxOutputTokens: number
  contextChars: number
  denyPatterns: RegExp[]
  baseURL?: string
  providerEnvKey: string
  rateLimitPerMinute: number
  secretKey?: string
  devMode: boolean
}

function setSseHeaders(res: ServerResponse): void {
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value)
  }
}

function sendEvent(res: ServerResponse, payload: object): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function sendErrorAndDone(res: ServerResponse, message: string): void {
  sendEvent(res, { error: message })
  res.write('data: [DONE]\n\n')
}

function isAuthorized(
  config: MiddlewareConfig,
  req: Connect.IncomingMessage,
): boolean {
  if (!config.secretKey) return true
  const url = new URL(req.url || '/', 'http://localhost')
  const qsSecret = url.searchParams.get('secret')
  const headerSecret =
    (req.headers['x-boltdocs-ask-ai-key'] as string | undefined) || undefined
  return qsSecret === config.secretKey || headerSecret === config.secretKey
}

export function createAskAiMiddleware(
  config: MiddlewareConfig,
  root = process.cwd(),
): Connect.NextHandleFunction {
  const docsDir = path.join(root, 'docs')
  return async (req, res, next) => {
    if (req.method !== 'POST' || req.url?.split('?')[0] !== config.endpoint) {
      return next()
    }

    setSseHeaders(res)

    const abortController = new AbortController()
    // Abort upstream on client disconnect so we stop paying LLM tokens.
    req.on('close', () => {
      if (!abortController.signal.aborted) abortController.abort()
    })

    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })

    req.on('end', async () => {
      try {
        if (!isAuthorized(config, req)) {
          sendErrorAndDone(res, 'UNAUTHORIZED')
          return
        }

        const rl = rateLimit(getClientIp(req), config.rateLimitPerMinute)
        if (!rl.ok) {
          res.setHeader('Retry-After', String(rl.retryAfter))
          sendErrorAndDone(res, `RATE_LIMITED (retry in ${rl.retryAfter}s)`)
          return
        }

        if (abortController.signal.aborted) return

        const payload: AskAiRequest = body ? JSON.parse(body) : {}
        const safety = checkInputSafety(
          payload.question ?? '',
          config.maxInputChars,
          config.denyPatterns,
        )
        if (!safety.ok) {
          sendErrorAndDone(res, safety.reason)
          return
        }
        // checkInputSafety rejects empty/non-string, so this is a string.
        const safeQuestion = payload.question ?? ''

        const resolution = await resolvePageContext({
          body: payload,
          currentPage: payload.currentPage || '/',
          contextChars: config.contextChars,
          docsDir,
        })

        if (resolution.context) {
          sendEvent(res, {
            context: {
              page: resolution.context.page,
              chars: resolution.context.content.length,
              elapsedMs: resolution.elapsedMs,
            },
          })
        } else {
          sendEvent(res, {
            context: {
              page: payload.currentPage || '/',
              chars: 0,
              elapsedMs: resolution.elapsedMs,
              missing: true,
            },
          })
        }

        if (abortController.signal.aborted) return

        const { streamLLMResponse } = await import('../server/index')

        await streamLLMResponse(
          {
            model: config.model,
            systemPrompt: config.systemPrompt,
            question: safeQuestion,
            context: resolution.context,
            maxOutputTokens: config.maxOutputTokens,
            baseURL: config.baseURL,
            env: process.env,
            signal: abortController.signal,
            provider: config.provider,
            providerEnvKey: config.providerEnvKey,
            devMode: config.devMode,
          },
          (event) => {
            if (event.type === 'text') {
              sendEvent(res, { text: event.data })
            } else if (event.type === 'error') {
              sendEvent(res, { error: event.data })
            } else if (event.type === 'usage' && config.devMode) {
              sendEvent(res, { usage: event.data })
            }
          },
        )

        res.write('data: [DONE]\n\n')
        res.end()
      } catch (err) {
        if (abortController.signal.aborted) {
          try {
            res.end()
          } catch {
            // socket gone
          }
          return
        }
        const msg = err instanceof Error ? err.message : 'Middleware error'
        warn(`[Ask AI] ${msg}`)
        try {
          sendErrorAndDone(res, msg)
        } catch {
          // socket gone
        }
      }
    })
  }
}
