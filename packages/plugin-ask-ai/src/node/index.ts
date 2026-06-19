import type { BoltdocsPlugin } from 'boltdocs'
import type { Connect } from 'vite'
import { info, warn } from '@bdocs/dui'

export interface AskAiPluginOptions {
  provider?: 'openai' | 'anthropic' | 'custom'
  model?: string
  autoInject?: boolean
  endpoint?: string
  systemPrompt?: string
  debug?: boolean
  ollamaModel?: string
}

const DEFAULT_SYSTEM_PROMPT = `You are a helpful, expert AI documentation assistant. 
Use the provided documentation context to answer the user's question accurately. 
If the information is not in the context, politely state that you do not know. 
Keep answers concise, accurate, and format code snippets in Markdown.`

const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1'

export default function askAiPlugin(
  options: AskAiPluginOptions = {},
): BoltdocsPlugin {
  const debug = options.debug === true
  const provider = options.provider || (debug ? 'custom' : 'openai')
  const model = options.model || (debug
    ? (options.ollamaModel || 'qwen2.5-coder:0.5b')
    : (provider === 'anthropic' ? 'claude-3-5-haiku-latest' : 'gpt-4o-mini'))
  const autoInject = options.autoInject !== false
  const endpoint = options.endpoint || '/api/ask-ai'
  const systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT
  const baseURL = debug ? OLLAMA_DEFAULT_BASE_URL : undefined

  if (debug) {
    info(`[Ask AI] Debug mode enabled → using Ollama (${model}) at ${OLLAMA_DEFAULT_BASE_URL}`)
  }

  return {
    name: 'boltdocs-plugin-ask-ai',
    version: '0.1.0',
    components: {
      AskAiBubble: '@bdocs/plugin-ask-ai/client',
      AskAiDialog: '@bdocs/plugin-ask-ai/client',
    },
    vitePlugins: [
      {
        name: 'vite-plugin-boltdocs-ask-ai-middleware',
        config() {
          return {
            define: {
              __BOLTDOCS_ASK_AI_DEBUG__: JSON.stringify(debug),
            },
          }
        },
        configureServer(server) {
          server.middlewares.use(
            createAskAiMiddleware(endpoint, {
              provider,
              model,
              systemPrompt,
              debug,
              baseURL,
            }),
          )
        },
        configurePreviewServer(server) {
          server.middlewares.use(
            createAskAiMiddleware(endpoint, {
              provider,
              model,
              systemPrompt,
              debug,
              baseURL,
            }),
          )
        },
      },
    ],
  }
}

interface MiddlewareConfig {
  provider: string
  model: string
  systemPrompt: string
  debug: boolean
  baseURL?: string
}

function createAskAiMiddleware(
  endpoint: string,
  config: MiddlewareConfig,
): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (
      req.method !== 'POST' ||
      req.url?.split('?')[0] !== endpoint
    ) {
      return next()
    }

    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })

    req.on('end', async () => {
      const startTime = Date.now()

      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('Access-Control-Allow-Origin', '*')

      try {
        const payload = JSON.parse(body)
        const { question, context } = payload

        if (config.debug) {
          info(`[Ask AI] ─── Request ───`)
          info(`[Ask AI]   Provider: ${config.provider}`)
          info(`[Ask AI]   Model:    ${config.model}`)
          info(`[Ask AI]   BaseURL:  ${config.baseURL || '(default provider URL)'}`)
          info(`[Ask AI]   Question: ${question?.slice(0, 200)}`)
          info(`[Ask AI]   Context docs: ${context?.length || 0}`)
        }

        if (!question) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Missing question in request body' }))
          return
        }

        const { streamLLMResponse } = await import('../server/index')

        let chunkCount = 0
        let firstChunkTime = 0

        await streamLLMResponse(
          {
            provider: config.provider,
            model: config.model,
            systemPrompt: config.systemPrompt,
            question,
            context: context || [],
            env: { ...process.env, ...(config.baseURL ? { OPENAI_BASE_URL: config.baseURL } : {}) },
            debug: config.debug,
          },
          (textChunk) => {
            if (chunkCount === 0) {
              firstChunkTime = Date.now() - startTime
            }
            chunkCount++
            res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`)
          },
        )

        const totalTime = Date.now() - startTime
        if (config.debug) {
          info(`[Ask AI] ─── Response ───`)
          info(`[Ask AI]   Chunks:      ${chunkCount}`)
          info(`[Ask AI]   First chunk: ${firstChunkTime}ms`)
          info(`[Ask AI]   Total time:  ${totalTime}ms`)
        }

        res.write('data: [DONE]\n\n')
        res.end()
      } catch (err) {
        warn(`[Ask AI] Middleware error: ${err}`)
        if (config.debug && err instanceof Error) {
          warn(`[Ask AI] Stack: ${err.stack}`)
        }
        res.write(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' })}\n\n`)
        res.end()
      }
    })
  }
}


