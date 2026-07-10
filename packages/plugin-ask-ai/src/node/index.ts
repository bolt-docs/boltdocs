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

const DEFAULT_SYSTEM_PROMPT = `Eres un asistente de documentación experto para analizar, redactar y explicar documentación técnica.

REGLAS ESTRICTAS:
- Responde SOLO basándote en el contexto de documentación proporcionado
- Si el contexto contiene la documentación de una página, resumes ESA página específicamente
- Usa markdown: bullet points para listas, **bold** para nombres de componentes/funciones, \`code\` para código inline, y code blocks para snippets
- Cada Snippets de código debe estar dentro de un bloque de código con el lenguaje especificado si es posible
- Si no tienes información suficiente, di "No encontré información suficiente sobre esto en la documentación"
- Sé conciso pero completo
- Responde en el idioma del usuario
- NO inventes información que no esté en el contexto
- Incluye ejemplos de uso cuando sea relevante`

const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1'

export default function askAiPlugin(
  options: AskAiPluginOptions = {},
): BoltdocsPlugin {
  const debug = options.debug === true
  // When debug=true, force custom provider + Ollama model regardless of explicit options.
  // The user's config might specify provider:'openai' but they want Ollama in debug mode.
  const provider = debug ? 'custom' : options.provider || 'openai'
  const model = debug
    ? options.ollamaModel || 'qwen2.5-coder:0.5b'
    : options.model ||
      (provider === 'anthropic' ? 'claude-3-5-haiku-latest' : 'gpt-4o-mini')
  const autoInject = options.autoInject !== false
  const endpoint = options.endpoint || '/api/ask-ai'
  const systemPrompt = options.systemPrompt || DEFAULT_SYSTEM_PROMPT
  const baseURL = debug ? OLLAMA_DEFAULT_BASE_URL : undefined

  if (debug) {
    info(
      `[Ask AI] Debug mode enabled → using Ollama (${model}) at ${OLLAMA_DEFAULT_BASE_URL}`,
    )
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
              docsDir: 'docs',
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
              docsDir: 'docs',
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
  docsDir: string
}

function createAskAiMiddleware(
  endpoint: string,
  config: MiddlewareConfig,
): Connect.NextHandleFunction {
  return (req, res, next) => {
    console.log(`[Ask AI Middleware] ${req.method} ${req.url}`)
    if (req.method !== 'POST' || req.url?.split('?')[0] !== endpoint) {
      return next()
    }

    if (config.debug) {
      info(`[Ask AI] Middleware hit: ${req.method} ${req.url}`)
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
        let { question, context, currentPage } = payload

        if (config.debug) {
          info(`[Ask AI] ─── Request ───`)
          info(`[Ask AI]   Provider: ${config.provider}`)
          info(`[Ask AI]   Model:    ${config.model}`)
          info(
            `[Ask AI]   BaseURL:  ${config.baseURL || '(default provider URL)'}`,
          )
          info(`[Ask AI]   Question: ${question?.slice(0, 200)}`)
          info(`[Ask AI]   Context docs from client: ${context?.length || 0}`)
          info(`[Ask AI]   Current page: ${currentPage || '(none)'}`)
        }

        if (!question) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Missing question in request body' }))
          return
        }

        try {
          const boltdocs = await import('boltdocs')
          const generateRoutes = boltdocs.generateRoutes
          const routes = await generateRoutes(config.docsDir, config)

          if (currentPage) {
            const normalizedPage = currentPage?.replace(/\/$/, '') || ''
            const currentDoc =
              routes.find((r: any) => {
                const routePath = r.path?.replace(/\/$/, '') || ''
                return routePath === normalizedPage
              }) ||
              routes.find((r: any) => {
                const routePath = r.path?.replace(/\/$/, '') || ''
                return (
                  normalizedPage.endsWith(routePath) && routePath.length > 5
                )
              })
            if (currentDoc && currentDoc._content) {
              context = [
                `Title: ${currentDoc.title}\nPath: ${currentDoc.path}\nContent: ${(currentDoc._content || '').slice(0, 3000)}`,
              ]
              if (config.debug) {
                info(
                  `[Ask AI]   Found current page: ${currentDoc.title} (${(currentDoc._content || '').length} chars)`,
                )
              }
            } else if (config.debug) {
              info(`[Ask AI]   No route matched for: ${normalizedPage}`)
            }
          }

          if (!context || context.length === 0) {
            const words = question
              .toLowerCase()
              .split(/\s+/)
              .filter((w: string) => w.length > 2)
            const scored = routes
              .filter((r: any) => r.title || r._content)
              .map((r: any) => {
                const title = (r.title || '').toLowerCase()
                const content = (r._content || '').toLowerCase()
                let score = 0
                for (const word of words) {
                  if (title.includes(word)) score += 10
                  if (content.includes(word)) score += 1
                }
                return { route: r, score }
              })
              .filter((s: any) => s.score > 0)
              .sort((a: any, b: any) => b.score - a.score)
              .slice(0, 5)

            context = scored.map(
              (s: any) =>
                `Title: ${s.route.title}\nPath: ${s.route.path}\nContent: ${(s.route._content || '').slice(0, 800)}`,
            )

            if (config.debug) {
              info(`[Ask AI]   Server-side context: ${context.length} docs`)
              for (const c of context) {
                info(`[Ask AI]     - ${c.split('\n')[0]}`)
              }
            }
          }
        } catch (e) {
          if (config.debug)
            warn(`[Ask AI]   Failed to generate server context: ${e}`)
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
            env: {
              ...process.env,
              ...(config.baseURL ? { OPENAI_BASE_URL: config.baseURL } : {}),
            },
            debug: config.debug,
          },
          (textChunk) => {
            if (chunkCount === 0) {
              firstChunkTime = Date.now() - startTime
              if (config.debug) {
                info(
                  `[Ask AI]   First chunk received after ${firstChunkTime}ms`,
                )
              }
            }
            chunkCount++
            if (config.debug && chunkCount <= 3) {
              info(
                `[Ask AI]   Chunk #${chunkCount}: "${textChunk.slice(0, 80)}"`,
              )
            }
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
        res.write(
          `data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' })}\n\n`,
        )
        res.end()
      }
    })
  }
}
