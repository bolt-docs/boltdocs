import path from 'node:path'

import { TransformCache } from '../cache'
import { docCache } from '../routes/cache'
import { normalizePath } from '../utils'
import type {
  DiagnosticRecord,
  PluginContext,
  PluginCachesAPI,
  PluginDiagnosticsAPI,
  PluginHmrAPI,
  PluginMemoryCacheAPI,
  PluginMiddlewareAPI,
  PluginPathsAPI,
  PluginRoutesCacheAPI,
  PluginServerAPI,
  PluginServerMiddleware,
  PluginTransformCacheAPI,
  PluginTransformMiddleware,
  PluginVirtualModulesAPI,
  RegisteredVirtualModule,
  RouteMeta,
  PluginHmrEvent,
} from '../../shared/types'

let diagnosticIdCounter = 0

/** Reserved namespace for core-emitted virtual modules. */
const CORE_VIRTUAL_PREFIX = 'virtual:boltdocs-'

/**
 * Soft cap on the in-process diagnostic queue. The queue is FIFO so older
 * reports age out when a plugin emits faster than the dev-server overlay
 * drains them. Tune via this constant if you want a longer history.
 */
const MAX_DIAGNOSTIC_RECORDS = 256

/**
 * Singleton registry of plugin-declared virtual modules, read by
 * `packages/core/src/node/plugin/virtual-modules.ts` when resolving the
 * `load()` hook. Keys are the full `virtual:foo/bar` ids.
 *
 * Wired into the HMR pipeline by `packages/core/src/node/dev-server/hmr-handler.ts`
 * so config changes flush the registry.
 */
export const virtualModuleRegistry = new Map<string, RegisteredVirtualModule>()

/**
 * Singleton registry of plugin-declared transform middleware entries.
 * Populated by plugins calling `ctx.middleware.add()` from lifecycle hooks
 * or declared statically via `BoltdocsPlugin.middleware`. The registry is
 * consumed by `PluginLifecycleManager.runMiddlewareChain()`.
 */
export const middlewareRegistry = new Map<string, PluginTransformMiddleware>()

/**
 * Diagnostic record book kept across the lifetime of the dev server. The
 * registry is process-local; for multi-instance deployments front this with
 * a remote sink (todo in a later phase).
 */
const diagnosticRecords: DiagnosticRecord[] = []

function nowIsoDate(): Date {
  return new Date()
}

/**
 * Build a `PluginCachesAPI` bound to the core's cache machinery. The
 * returned object does not leak implementation details (no `TransformCache`
 * or `FileCache` references cross the surface).
 */
export function createPluginCachesAPI(): PluginCachesAPI {
  return {
    transform(namespace: string): PluginTransformCacheAPI {
      // Namespace prevents cross-plugin collisions on the same directory.
      const cache = new TransformCache(`plugin:${namespace}`)
      return {
        async get(key: string): Promise<string | null> {
          return cache.getAsync(key)
        },
        set(key: string, value: string): void {
          cache.set(key, value)
        },
        async flush(): Promise<void> {
          await cache.flush()
        },
      }
    },
    routes: createRoutesCacheAPI(),
    memory<V>(
      namespace: string,
      opts?: { max?: number; ttl?: number },
    ): PluginMemoryCacheAPI<V> {
      // Bounded FIFO cache backed by a plain `Map<string, V>` — JS Maps
      // preserve insertion order so `keys().next().value` gives the
      // oldest entry, which we evict on overflow. We deliberately avoid
      // `lru-cache` here because its generic constraint (`V extends {}`)
      // makes the typed-wrapper ergonomics worse than rolling this
      // minimal version. Semantics: FIFO, not LRU. If you need true
      // LRU, swap to `lru-cache` and narrow the generic accordingly.
      const keyPrefix = `${namespace}:`
      const ttl = opts?.ttl
      const max = opts?.max ?? 100
      const store = new Map<string, { value: V; expiresAt: number | null }>()
      function isExpired(entry: { expiresAt: number | null }): boolean {
        return entry.expiresAt !== null && entry.expiresAt <= Date.now()
      }
      return {
        get(key: string): V | undefined {
          const entry = store.get(keyPrefix + key)
          if (!entry) return undefined
          if (isExpired(entry)) {
            store.delete(keyPrefix + key)
            return undefined
          }
          return entry.value
        },
        set(key: string, value: V): void {
          const fullKey = keyPrefix + key
          if (!store.has(fullKey) && store.size >= max) {
            const oldest = store.keys().next().value
            if (oldest !== undefined) store.delete(oldest)
          }
          store.set(fullKey, {
            value,
            expiresAt: ttl !== undefined ? Date.now() + ttl : null,
          })
        },
        has(key: string): boolean {
          const entry = store.get(keyPrefix + key)
          if (!entry) return false
          if (isExpired(entry)) {
            store.delete(keyPrefix + key)
            return false
          }
          return true
        },
      }
    },
  }
}

/**
 * Routes cache wrapper.
 *
 * **`set` writes a partial record.** The internal `docCache` stores the
 * full `ParsedDocFile` (with `_content`, headings, sidebar, etc.). Plugins
 * that read via `get` will see a `{ route: RouteMeta }` projection. Mixing
 * plugin-side `set` with the parser-side `set` in the same key will clobber
 * each other — the parser layer always wins on the next refresh. Plugins
 * should not expect their `set` to round-trip beyond the next file
 * watcher tick.
 */
function createRoutesCacheAPI(): PluginRoutesCacheAPI {
  return {
    get(filePath: string): RouteMeta | null {
      const parsed = docCache.get(filePath) as { route: RouteMeta } | null
      return parsed?.route ?? null
    },
    set(filePath: string, route: RouteMeta): void {
      // We deliberately project just the route. See function JSDoc above.
      docCache.set(filePath, { route } as unknown as Parameters<
        typeof docCache.set
      >[1])
    },
    invalidate(filePath: string): void {
      docCache.invalidate(filePath)
    },
    invalidateAll(): void {
      docCache.invalidateAll()
    },
  }
}

/**
 * Build a `PluginDiagnosticsAPI` bound to the plugin's name (used as
 * `pluginName` on records). Records accumulate in a process-level
 * FIFO-capped queue; the oldest record is evicted when a plugin emits
 * faster than the dev-server overlay drains.
 *
 * Drain via `list()` from a reporter; this is a snapshot, not a live
 * stream.
 */
export function createPluginDiagnosticsAPI(
  pluginName: string,
): PluginDiagnosticsAPI {
  return {
    report(
      severity: DiagnosticRecord['severity'],
      code: string,
      message: string,
      where?: { filePath?: string; routePath?: string },
    ): void {
      const id = ++diagnosticIdCounter
      const record: DiagnosticRecord = {
        id,
        severity,
        code,
        message,
        pluginName,
        filePath: where?.filePath,
        routePath: where?.routePath,
        time: nowIsoDate(),
      }
      diagnosticRecords.push(record)
      if (diagnosticRecords.length > MAX_DIAGNOSTIC_RECORDS) {
        const evicted = diagnosticRecords.length - MAX_DIAGNOSTIC_RECORDS
        diagnosticRecords.splice(0, evicted)
      }
    },
    list(): readonly DiagnosticRecord[] {
      return Object.freeze([...diagnosticRecords])
    },
    clear(): void {
      diagnosticRecords.length = 0
    },
  }
}

/**
 * Build a `PluginPathsAPI` rooted at the docs dir + project root. Both
 * `resolve*` methods validate against traversal AND absolute-path
 * injection (when a caller passes `'/etc/passwd'` to a `resolveDocs()` call
 * bounded at a project dir, the resulting location is outside the
 * workspace and is rejected).
 */
export function createPluginPathsAPI(
  docsDir: string,
  rootDir: string,
): PluginPathsAPI {
  return {
    resolveDocs(...parts: string[]): string {
      return resolveInside(docsDir, ...parts)
    },
    resolveAsset(...parts: string[]): string {
      return resolveInside(rootDir, ...parts)
    },
    safeFileURL(absFilePath: string): string {
      const resolved = path.resolve(absFilePath)
      return `file://${resolved.replace(/\\/g, '/')}`
    },
  }
}

function resolveInside(base: string, ...parts: string[]): string {
  const baseResolved = path.resolve(base)
  const joined = path.resolve(baseResolved, ...parts)
  // Reject anything that escapes the base directory. `path.relative`
  // returns a `..`-prefixed string for targets outside the base, which the
  // first clause catches. Absolute targets outside the base come back as a
  // `..`-prefixed relative path too, but the second clause is a defensive
  // belt-and-braces for cases where relative returns an absolute (rare
  // but possible on Windows).
  const rel = path.relative(baseResolved, joined)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(
      `[boltdocs/plugin-context] Path '${parts.join('/')}' resolves to '${joined}' which is outside the workspace boundary '${baseResolved}'.`,
    )
  }
  return normalizePath(joined)
}

/**
 * Build a `PluginVirtualModulesAPI` that writes to the process-level
 * `virtualModuleRegistry`. The registry is consulted by
 * `vite-plugin-boltdocs-virtual-modules` on every `load()` call.
 *
 * Registration rules:
 *   - **Collision**: throw on duplicate ids so two plugins cannot silently
 *     overwrite each other's modules.
 *   - **Prefix reservation**: refuse `virtual:boltdocs-*` ids outright so
 *     the core namespace stays owned by `vite-plugin-boltdocs-virtual-modules`.
 *   - **`eager` flag**: accepted at registration time but not consulted at
 *     load. It exists so a future Phase can auto-inject imports of the
 *     virtual into `boltdocs-entry.tsx`.
 */
export function createPluginVirtualModulesAPI(): PluginVirtualModulesAPI {
  return {
    add(id, loader, opts): void {
      if (virtualModuleRegistry.has(id)) {
        throw new Error(
          `[boltdocs] Virtual module '${id}' is already registered. Pick a unique id (e.g. prefix it with your plugin name) so two plugins do not collide.`,
        )
      }
      if (id.startsWith(CORE_VIRTUAL_PREFIX)) {
        throw new Error(
          `[boltdocs] Virtual module id '${id}' starts with the reserved prefix '${CORE_VIRTUAL_PREFIX}'. Use your own plugin namespace (e.g. 'virtual:my-plugin/...').`,
        )
      }
      virtualModuleRegistry.set(id, {
        id,
        eager: opts?.eager ?? false,
        loader,
      })
    },
    has(id: string): boolean {
      return virtualModuleRegistry.has(id)
    },
    list(): readonly RegisteredVirtualModule[] {
      return Object.freeze([...virtualModuleRegistry.values()])
    },
  }
}

/**
 * Drop every registered plugin virtual from the in-process registry. Use
 * when the plugin set or `boltdocs.config.ts` changes so plugins re-register
 * their virtuals on the next `beforeBuild`/`beforeDev` pass. Wired into the
 * HMR pipeline at `packages/core/src/node/dev-server/hmr-handler.ts`.
 */
export function invalidateVirtualModulesCache(): void {
  virtualModuleRegistry.clear()
}

/**
 * Drop a single registered virtual. Useful when a plugin's content change
 * requires its previously-emitted source to be regenerated.
 */
export function invalidateVirtualModule(id: string): void {
  virtualModuleRegistry.delete(id)
}

/**
 * Build a `PluginHmrAPI` that lets plugins hook into file-watching events
 * and send custom HMR messages to connected clients.
 *
 * Handlers are stored in the global `hmrFileHandlers` registry and run
 * by `runPluginHmrHandlers()` after the core's own HMR processing.
 * The `send()` method uses the global `_hmrSender` function set by the
 * dev server at setup time via `setHmrSender()`.
 */
export function createPluginHmrAPI(): PluginHmrAPI {
  function ensureHandlers(eventType: PluginHmrEvent) {
    if (!hmrFileHandlers.has(eventType)) {
      hmrFileHandlers.set(eventType, new Set())
    }
    return hmrFileHandlers.get(eventType)!
  }

  return {
    onFileEvent(
      eventType: PluginHmrEvent,
      handler: (filePath: string) => void | Promise<void>,
    ): void {
      ensureHandlers(eventType).add(handler)
    },
    onFileAdd(handler): void {
      ensureHandlers('add').add(handler)
    },
    onFileChange(handler): void {
      ensureHandlers('change').add(handler)
    },
    onFileUnlink(handler): void {
      ensureHandlers('unlink').add(handler)
    },
    send(event: string, data?: unknown): void {
      _hmrSender?.(`boltdocs:plugin:${event}`, data)
    },
  }
}

/**
 * Run the HMR plugin handlers for a given event type. Called by the core
 * dev-server after processing a file event.
 */
export async function runPluginHmrHandlers(
  eventType: PluginHmrEvent,
  filePath: string,
): Promise<void> {
  const registry = hmrFileHandlers.get(eventType)
  if (!registry) return
  for (const handler of registry) {
    await handler(filePath)
  }
}

/**
 * Counter for auto-generating keys for unnamed middleware entries.
 */
let unnamedMiddlewareCounter = 0

/**
 * Internal registry that stores the handlers registered via
 * `PluginHmrAPI`. Read by `runPluginHmrHandlers()` during HMR.
 *
 * The registry is process-scoped and shared across all plugins.
 * `createPluginHmrAPI()` writes directly to this registry.
 */
const hmrFileHandlers: Map<
  PluginHmrEvent,
  Set<(filePath: string) => void | Promise<void>>
> = new Map()

/**
 * Global WebSocket send function, set by the dev server at setup time.
 * Used by `PluginHmrAPI.send()` to broadcast to connected clients.
 */
let _hmrSender: ((event: string, data?: unknown) => void) | null = null

/**
 * Set the global HMR sender function. Called by the dev server during
 * setup with `server.ws.send` bound to the correct context.
 */
export function setHmrSender(
  sender: (event: string, data?: unknown) => void,
): void {
  _hmrSender = sender
}

/**
 * Global registry of plugin-registered server middleware, populated by
 * `createPluginServerAPI()` and applied by `applyPluginServerMiddleware()`
 * during server setup.
 */
const pluginServerMiddleware: PluginServerMiddleware[] = []

/**
 * Global queue of server lifecycle callbacks.
 */
const serverStartCallbacks: Array<() => void | Promise<void>> = []
const serverEndCallbacks: Array<() => void | Promise<void>> = []

/**
 * Apply all plugin-registered server middleware to a Vite dev/preview
 * server. Called during server setup after all plugins have had their
 * `beforeDev` hooks run.
 */
export function applyPluginServerMiddleware(server: {
  middlewares: { use: (fn: (req: any, res: any, next: any) => void) => void }
}): void {
  for (const mw of pluginServerMiddleware) {
    server.middlewares.use(mw)
  }
}

/**
 * Run all registered server `onStart` callbacks.
 */
export async function runPluginServerStartCallbacks(): Promise<void> {
  for (const cb of serverStartCallbacks) {
    await cb()
  }
}

/**
 * Run all registered server `onEnd` callbacks.
 */
export async function runPluginServerEndCallbacks(): Promise<void> {
  for (const cb of serverEndCallbacks) {
    await cb()
  }
}

/**
 * Build a `PluginServerAPI` that lets plugins register HTTP middleware
 * and server lifecycle hooks without writing a full Vite plugin.
 *
 * All state is stored in process-level registries and applied by
 * `applyPluginServerMiddleware()`, `runPluginServerStartCallbacks()`,
 * and `runPluginServerEndCallbacks()` during server setup.
 */
export function createPluginServerAPI(): PluginServerAPI {
  return {
    use(middleware: PluginServerMiddleware): void {
      pluginServerMiddleware.push(middleware)
    },
    useAt(path: string, handler: PluginServerMiddleware): void {
      const wrapped: PluginServerMiddleware = (req, res, next) => {
        if (req.url?.startsWith(path)) {
          return handler(req, res, next)
        }
        next()
      }
      pluginServerMiddleware.push(wrapped)
    },
    onStart(callback): void {
      serverStartCallbacks.push(callback)
    },
    onEnd(callback): void {
      serverEndCallbacks.push(callback)
    },
  }
}

/**
 * Build a `PluginMiddlewareAPI` that writes to the process-level
 * `middlewareRegistry`. The registry is consumed by
 * `PluginLifecycleManager.runMiddlewareChain()` during the build pipeline.
 */
export function createPluginMiddlewareAPI(): PluginMiddlewareAPI {
  return {
    add(middleware: PluginTransformMiddleware): void {
      const key = middleware.name ?? `_unnamed_${unnamedMiddlewareCounter++}`
      if (middlewareRegistry.has(key)) {
        throw new Error(
          `[boltdocs] Middleware '${middleware.name ?? '<unnamed>'}' is already registered.`,
        )
      }
      middlewareRegistry.set(key, middleware)
    },
    remove(name: string): void {
      middlewareRegistry.delete(name)
    },
    has(name: string): boolean {
      return middlewareRegistry.has(name)
    },
    list(): readonly PluginTransformMiddleware[] {
      return Object.freeze([...middlewareRegistry.values()])
    },
  }
}

/**
 * Drop all registered middleware from the in-process registry. Use when
 * the plugin set or config changes.
 */
export function invalidateMiddlewareCache(): void {
  middlewareRegistry.clear()
}

/**
 * Test helper: clear all in-process plugin registries between test runs.
 * Not exported through the public surface.
 */
export function __resetPluginContextStateForTests(): void {
  diagnosticRecords.length = 0
  virtualModuleRegistry.clear()
  middlewareRegistry.clear()
  hmrFileHandlers.clear()
  pluginServerMiddleware.length = 0
  serverStartCallbacks.length = 0
  serverEndCallbacks.length = 0
  _hmrSender = null
}
