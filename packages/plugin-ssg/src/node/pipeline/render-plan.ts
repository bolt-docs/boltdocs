import crypto from 'node:crypto'
import { join } from 'node:path'
import { getCanonicalRouteKey } from '../cache-io'
import { removeLeadingSlash, withTrailingSlash } from '../../utils/path'

export interface RenderSourceMeta {
  readonly hash: string
  readonly mtimeMs: number
}

export interface RenderPlan {
  readonly path: string
  readonly pathHash: string
  readonly cachedHtmlFile: string
  readonly cachedLoaderFile: string
  readonly finalOutFile: string
  readonly normalizedKey: string
  readonly sourceContentHash: string
  readonly sourceMtimeMs: number
  readonly routeAssetHash: string
  readonly fetchUrl: string
}

export interface CreateRenderPlansInput {
  readonly routes: readonly string[]
  readonly outDir: string
  readonly ssgPagesDir: string
  readonly dirStyle: 'flat' | 'nested'
  readonly contextBase: string
  readonly fallbackHash: string
  readonly routeToSourceFileMap: Readonly<Record<string, string>>
  readonly sourceMeta: ReadonlyMap<string, RenderSourceMeta>
  readonly routeToAssetHash: Readonly<Record<string, string>>
}

function getOutputFilename(path: string, dirStyle: 'flat' | 'nested'): string {
  if (dirStyle === 'nested') {
    return join(path.replace(/^\//g, ''), 'index.html')
  }
  return `${(path.endsWith('/') ? `${path}index` : path).replace(/^\//g, '')}.html`
}

function freezePlan(plan: RenderPlan): RenderPlan {
  return Object.freeze(plan)
}

/**
 * Build all per-route values once. This function intentionally performs no I/O
 * and does not inspect Vite, React, or the worker pool.
 */
export function createRenderPlans(
  input: CreateRenderPlansInput,
): ReadonlyMap<string, RenderPlan> {
  const plans = new Map<string, RenderPlan>()

  for (const path of input.routes) {
    const pathHash = crypto.createHash('md5').update(path).digest('hex')
    const normalizedKey = getCanonicalRouteKey(path)
    const sourceFile =
      input.routeToSourceFileMap[normalizedKey] ||
      input.routeToSourceFileMap[path]
    const source = sourceFile ? input.sourceMeta.get(sourceFile) : undefined

    plans.set(
      path,
      freezePlan({
        path,
        pathHash,
        cachedHtmlFile: join(input.ssgPagesDir, `${pathHash}.html`),
        cachedLoaderFile: join(input.ssgPagesDir, `${pathHash}.json`),
        finalOutFile: join(
          input.outDir,
          getOutputFilename(path, input.dirStyle),
        ),
        normalizedKey,
        sourceContentHash: source?.hash || input.fallbackHash,
        sourceMtimeMs: source?.mtimeMs || 0,
        routeAssetHash: input.routeToAssetHash[path] ?? input.fallbackHash,
        fetchUrl: `${withTrailingSlash(input.contextBase)}${removeLeadingSlash(path)}`,
      }),
    )
  }

  return plans
}

export function getRenderPlan(
  plans: ReadonlyMap<string, RenderPlan>,
  path: string,
): RenderPlan {
  const plan = plans.get(path)
  if (!plan) throw new Error(`Missing render plan for route: ${path}`)
  return plan
}

export function getRenderPlanOutputDirectory(plan: RenderPlan): string {
  return plan.finalOutFile
}

export { getOutputFilename }
