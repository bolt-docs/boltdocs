import path from 'node:path'
import { timingSafeEqual } from 'node:crypto'
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
  maxRequestBytes: number
  secretKey?: string
  devMode: boolean
  /** Sampling temperature (forwarded to streamLLMResponse). */
  temperature?: number
  /** Nucleus sampling cutoff (forwarded to streamLLMResponse). */
  topP?: number
}

function setSseHeaders(res: ServerResponse): void {
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value)
  }
}

function sendEvent(res: ServerResponse, payload: object): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function sendError(
  res: ServerResponse,
  message: string,
  statusCode: number,
): void {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.write(JSON.stringify({ error: message }))
  res.end()
}

function safeSecretEqual(candidate: string, expected: string): boolean {
  const candidateBytes = Buffer.from(candidate)
  const expectedBytes = Buffer.from(expected)
  return (
    candidateBytes.byteLength === expectedBytes.byteLength &&
    timingSafeEqual(candidateBytes, expectedBytes)
  )
}

function isAuthorized(
  config: MiddlewareConfig,
  req: Connect.IncomingMessage,
): boolean {
  if (!config.secretKey) return true
  const headerSecret = req.headers['x-boltdocs-ask-ai-key']
  const value = Array.isArray(headerSecret) ? headerSecret[0] : headerSecret
  return value ? safeSecretEqual(value, config.secretKey) : false
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

    if (!isAuthorized(config, req)) {
      req.resume()
      sendError(res, 'UNAUTHORIZED', 401)
      return
    }

    const rl = rateLimit(getClientIp(req), config.rateLimitPerMinute)
    if (!rl.ok) {
      req.resume()
      res.setHeader('Retry-After', String(rl.retryAfter))
      sendError(res, `RATE_LIMITED (retry in ${rl.retryAfter}s)`, 429)
      return
    }

    const abortController = new AbortController()
    // Abort upstream on client disconnect so we stop paying LLM tokens.
    req.on('close', () => {
      if (!req.complete && !abortController.signal.aborted) {
        abortController.abort()
      }
    })
    res.on('close', () => {
      if (!res.writableEnded && !abortController.signal.aborted) {
        abortController.abort()
      }
    })

    let body = ''
    let bodyBytes = 0
    let bodyTooLarge = false
    req.on('data', (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      bodyBytes += buffer.byteLength
      if (bodyBytes > config.maxRequestBytes) {
        bodyTooLarge = true
        body = ''
        return
      }
      body += buffer.toString('utf8')
    })

    req.on('end', async () => {
      try {
        if (bodyTooLarge) {
          sendError(res, 'REQUEST_TOO_LARGE', 413)
          return
        }

        if (abortController.signal.aborted) {
          res.end()
          return
        }

        const payload: AskAiRequest = body ? JSON.parse(body) : {}
        const safety = checkInputSafety(
          payload.question ?? '',
          config.maxInputChars,
          config.denyPatterns,
        )
        if (!safety.ok) {
          sendError(res, safety.reason, 400)
          return
        }
        // checkInputSafety rejects empty/non-string, so this is a string.
        const safeQuestion = payload.question ?? ''

        const resolution = await resolvePageContext({
          // Vite/preview resolves context from the local route tree. Never
          // trust a client-provided context in this server-side path.
          body: { currentPage: payload.currentPage },
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

        if (abortController.signal.aborted) {
          res.end()
          return
        }

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
            temperature: config.temperature,
            topP: config.topP,
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
      } catch {
        if (abortController.signal.aborted) {
          try {
            res.end()
          } catch {
            // socket gone
          }
          return
        }
        warn('[Ask AI] request failed')
        try {
          sendError(res, 'MIDDLEWARE_ERROR', 500)
        } catch {
          // socket gone
        }
      }
    })
  }
}
