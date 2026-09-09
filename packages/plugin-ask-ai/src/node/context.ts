import { warn } from '@bdocs/dui'

interface RouteLike {
  path?: string
  title?: string
  _content?: string
}

interface PageContext {
  page: string
  content: string
}

interface ContextResolution {
  context: PageContext | null
  elapsedMs: number
}

interface ResolvePageContextOptions {
  body: unknown
  currentPage: string
  contextChars: number
  docsDir: string
}

function normalizePath(p: string): string {
  return p.replace(/\/+$/, '') || '/'
}

interface PageMatch {
  route: RouteLike
}

function findCurrentDoc(
  routes: RouteLike[],
  currentPage: string,
): PageMatch | null {
  const normalizedPage = normalizePath(currentPage)
  const exact =
    routes.find((r) => normalizePath(r.path || '') === normalizedPage) || null
  if (exact) return { route: exact }
  let best: { route: RouteLike; score: number } | null = null
  for (const r of routes) {
    const p = normalizePath(r.path || '')
    if (p === '/' || p.length < 4) continue
    if (normalizedPage.endsWith(p)) {
      const score = p.length
      if (!best || score > best.score) best = { route: r, score }
    }
  }
  if (best) return { route: best.route }
  return null
}

// Client-supplied context (serverless deployments) is trusted only up to the
// configured cap. Any malformed payload falls through to server resolution.
export function pickClientContext(
  body: unknown,
  contextChars: number,
): PageContext | null {
  if (!body || typeof body !== 'object') return null
  const c = (body as { context?: unknown }).context
  if (
    c &&
    typeof c === 'object' &&
    typeof (c as { page?: unknown }).page === 'string' &&
    typeof (c as { content?: unknown }).content === 'string'
  ) {
    const page = (c as { page: string }).page
    const content = (c as { content: string }).content
    return {
      page: page.slice(0, 256),
      content: content.slice(0, contextChars),
    }
  }
  return null
}

export async function resolvePageContext(
  options: ResolvePageContextOptions,
): Promise<ContextResolution> {
  const start = Date.now()
  const clientContext = pickClientContext(options.body, options.contextChars)
  if (clientContext) {
    return { context: clientContext, elapsedMs: Date.now() - start }
  }
  try {
    const boltdocs = await import('boltdocs')
    const routes = await boltdocs.generateRoutes(options.docsDir)
    const match = findCurrentDoc(routes, options.currentPage)
    if (match) {
      return {
        context: {
          page: match.route.path || options.currentPage,
          content: (match.route._content || '').slice(0, options.contextChars),
        },
        elapsedMs: Date.now() - start,
      }
    }
  } catch (e) {
    warn(`[Ask AI] Failed to resolve current page: ${e}`)
  }
  return { context: null, elapsedMs: Date.now() - start }
}
