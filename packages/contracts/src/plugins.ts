import type {
  CodeHighlighterAdapter,
  CodeHighlightConfig,
} from './highlighting'
import type { RouteMeta } from './routes'

export interface PluginLogger {
  info(message: string): void
  warn(message: string): void
  error(message: string | Error): void
  debug(message: string): void
}

export interface PluginStore {
  get<T = unknown>(pluginName: string, key: string): T | undefined
  set(pluginName: string, key: string, value: unknown): void
  has(pluginName: string, key: string): boolean
}

export interface PluginMeta {
  name: string
  version?: string
  boltdocsVersion?: string
}

export type ChainSignal = 'skip' | 'break'
export type TransformResult<T> = T & { __signal?: ChainSignal }

export interface TransformSourceParams {
  code: string
  filePath: string
  frontmatter?: Record<string, unknown>
}

export interface TransformHtmlParams {
  html: string
  path: string
  route?: RouteMeta
}

export interface PluginCachesAPI {
  transform(namespace: string): PluginTransformCacheAPI
  routes: PluginRoutesCacheAPI
  memory<V = unknown>(
    namespace: string,
    opts?: { max?: number; ttl?: number },
  ): PluginMemoryCacheAPI<V>
}

export interface PluginTransformCacheAPI {
  get(key: string): Promise<string | null>
  set(key: string, value: string): void
  flush(): Promise<void>
}

export interface PluginRoutesCacheAPI {
  get(filePath: string): RouteMeta | null
  set(filePath: string, route: RouteMeta): void
  invalidate(filePath: string): void
  invalidateAll(): void
}

export interface PluginMemoryCacheAPI<V> {
  get(key: string): V | undefined
  set(key: string, value: V): void
  has(key: string): boolean
}

export interface DiagnosticRecord {
  readonly id: number
  readonly severity: 'info' | 'warn' | 'error'
  readonly code: string
  readonly message: string
  readonly pluginName: string
  readonly filePath?: string
  readonly routePath?: string
  readonly time: Date
}

export interface PluginDiagnosticsAPI {
  report(
    severity: DiagnosticRecord['severity'],
    code: string,
    message: string,
    where?: { filePath?: string; routePath?: string },
  ): void
  list(): readonly DiagnosticRecord[]
  clear(): void
}

export interface PluginPathsAPI {
  resolveDocs(...parts: string[]): string
  resolveAsset(...parts: string[]): string
  safeFileURL(absFilePath: string): string
}

export interface RegisteredVirtualModule {
  readonly id: string
  readonly eager: boolean
  readonly loader: () => string | Promise<string>
}

export interface PluginVirtualModulesAPI {
  add(
    id: string,
    loader: () => string | Promise<string>,
    opts?: { eager?: boolean },
  ): void
  has(id: string): boolean
  list(): readonly RegisteredVirtualModule[]
}

export type PluginHmrEvent = 'add' | 'change' | 'unlink'

export interface PluginHmrAPI {
  onFileEvent(
    eventType: PluginHmrEvent,
    handler: (filePath: string) => void | Promise<void>,
  ): void
  onFileAdd(handler: (filePath: string) => void | Promise<void>): void
  onFileChange(handler: (filePath: string) => void | Promise<void>): void
  onFileUnlink(handler: (filePath: string) => void | Promise<void>): void
  send(event: string, data?: unknown): void
}

export type PluginServerMiddleware<Request = unknown, Response = unknown> = (
  req: Request,
  res: Response,
  next: (err?: unknown) => void,
) => void | Promise<void>

export interface PluginServerAPI<Request = unknown, Response = unknown> {
  use(middleware: PluginServerMiddleware<Request, Response>): void
  useAt(path: string, handler: PluginServerMiddleware<Request, Response>): void
  onStart(callback: () => void | Promise<void>): void
  onEnd(callback: () => void | Promise<void>): void
}

export type BoltdocsUiSlot =
  | 'search:dialog'
  | 'header:left'
  | 'header:right'
  | 'sidebar:top'
  | 'sidebar:bottom'
  | 'page:before'
  | 'page:after'
  | (string & {})

export interface PluginHeadEntry {
  tag: 'script' | 'link' | 'meta' | 'style'
  attrs?: Record<string, string | boolean>
  content?: string
}

export interface PluginClientConfig {
  slots?: Record<string, string>
  providers?: string[]
  mdxComponents?: Record<string, string>
  head?: PluginHeadEntry[]
}

export interface SearchDocument {
  id: string
  path: string
  title: string
  content: string
  headings: Array<{ level: number; text: string; id: string }>
  frontmatter: Record<string, unknown>
  locale?: string
  version?: string
}

export interface PluginContext<
  Config = Record<string, unknown>,
  Request = unknown,
  Response = unknown,
> {
  readonly config: Config
  readonly logger: PluginLogger
  readonly store: PluginStore
  readonly meta: PluginMeta
  readonly docsDir: string
  readonly rootDir: string
  readonly outDir: string
  readonly routes: RouteMeta[]
  readonly caches: PluginCachesAPI
  readonly diagnostics: PluginDiagnosticsAPI
  readonly paths: PluginPathsAPI
  readonly virtualModules: PluginVirtualModulesAPI
  readonly middleware: PluginMiddlewareAPI<Config, Request, Response>
  readonly hmr: PluginHmrAPI
  readonly server: PluginServerAPI<Request, Response>
}

export interface PluginTransformMiddleware<
  Config = Record<string, unknown>,
  Request = unknown,
  Response = unknown,
> {
  name?: string
  enforce?: 'pre' | 'post'
  transformSource?: (
    ctx: PluginContext<Config, Request, Response>,
    params: TransformSourceParams,
  ) =>
    | TransformResult<{ code: string }>
    | Promise<TransformResult<{ code: string }>>
  transformMdx?: (
    ctx: PluginContext<Config, Request, Response>,
    params: TransformSourceParams,
  ) =>
    | TransformResult<{ code: string }>
    | Promise<TransformResult<{ code: string }>>
  transformHtml?: (
    ctx: PluginContext<Config, Request, Response>,
    params: TransformHtmlParams,
  ) =>
    | TransformResult<{ html: string }>
    | Promise<TransformResult<{ html: string }>>
}

export interface PluginMiddlewareAPI<
  Config = Record<string, unknown>,
  Request = unknown,
  Response = unknown,
> {
  add(middleware: PluginTransformMiddleware<Config, Request, Response>): void
  remove(name: string): void
  has(name: string): boolean
  list(): readonly PluginTransformMiddleware<Config, Request, Response>[]
}

export interface PluginLifecycleHooks<
  Config = Record<string, unknown>,
  Request = unknown,
  Response = unknown,
> {
  'build:before'?: (
    ctx: PluginContext<Config, Request, Response>,
  ) => Promise<void> | void
  'build:after'?: (
    ctx: PluginContext<Config, Request, Response>,
  ) => Promise<void> | void
  'build:end'?: (
    ctx: PluginContext<Config, Request, Response>,
  ) => Promise<void> | void
  'build:generate'?: (
    ctx: PluginContext<Config, Request, Response>,
    params: { routes: RouteMeta[]; outDir: string; siteUrl?: string },
  ) => void | Promise<void>
  'dev:before'?: (
    ctx: PluginContext<Config, Request, Response>,
  ) => Promise<void> | void
  'dev:after'?: (
    ctx: PluginContext<Config, Request, Response>,
  ) => Promise<void> | void
  'transform:source'?: (
    ctx: PluginContext<Config, Request, Response>,
    params: TransformSourceParams,
  ) =>
    | TransformResult<{ code: string }>
    | Promise<TransformResult<{ code: string }>>
  'transform:mdx'?: (
    ctx: PluginContext<Config, Request, Response>,
    params: TransformSourceParams,
  ) =>
    | TransformResult<{ code: string }>
    | Promise<TransformResult<{ code: string }>>
  'transform:html'?: (
    ctx: PluginContext<Config, Request, Response>,
    params: TransformHtmlParams,
  ) =>
    | TransformResult<{ html: string }>
    | Promise<TransformResult<{ html: string }>>
  'frontmatter:transform'?: (
    ctx: PluginContext<Config, Request, Response>,
    params: {
      frontmatter: Record<string, unknown>
      filePath: string
      rawContent: string
    },
  ) => Record<string, unknown> | Promise<Record<string, unknown>> | undefined
  'routes:resolved'?: (
    ctx: PluginContext<Config, Request, Response>,
    params: { routes: RouteMeta[] },
  ) => RouteMeta[] | Promise<RouteMeta[]> | undefined
  'search:index'?: (
    ctx: PluginContext<Config, Request, Response>,
    params: { documents: SearchDocument[]; routes: RouteMeta[] },
  ) => unknown | Promise<unknown>
  'server:configure'?: (
    ctx: PluginContext<Config, Request, Response>,
    params: { server: unknown; middleware: PluginServerAPI<Request, Response> },
  ) => void | Promise<void>
  beforeBuild?: (
    ctx: PluginContext<Config, Request, Response>,
  ) => Promise<void> | void
  afterBuild?: (
    ctx: PluginContext<Config, Request, Response>,
  ) => Promise<void> | void
  buildEnd?: (
    ctx: PluginContext<Config, Request, Response>,
  ) => Promise<void> | void
  beforeDev?: (
    ctx: PluginContext<Config, Request, Response>,
  ) => Promise<void> | void
  afterDev?: (
    ctx: PluginContext<Config, Request, Response>,
  ) => Promise<void> | void
  transformSource?: (
    ctx: PluginContext<Config, Request, Response>,
    params: TransformSourceParams,
  ) =>
    | TransformResult<{ code: string }>
    | Promise<TransformResult<{ code: string }>>
  transformMdx?: (
    ctx: PluginContext<Config, Request, Response>,
    params: TransformSourceParams,
  ) =>
    | TransformResult<{ code: string }>
    | Promise<TransformResult<{ code: string }>>
  transformHtml?: (
    ctx: PluginContext<Config, Request, Response>,
    params: TransformHtmlParams,
  ) =>
    | TransformResult<{ html: string }>
    | Promise<TransformResult<{ html: string }>>
}

export interface IPluginLifecycleManager<
  Config = Record<string, unknown>,
  Request = unknown,
  Response = unknown,
> {
  runHook(
    hookName: keyof PluginLifecycleHooks<Config, Request, Response>,
    ...args: unknown[]
  ): Promise<void>
  runChain<TParams extends Record<string, unknown>>(
    hookName: keyof PluginLifecycleHooks<Config, Request, Response>,
    initialParams: TParams,
  ): Promise<TParams>
  runMiddlewareChain<TParams extends Record<string, unknown>>(
    hookName: 'transformSource' | 'transformMdx' | 'transformHtml',
    initialParams: TParams,
  ): Promise<TParams>
  hasHook(
    hookName:
      | keyof PluginLifecycleHooks<Config, Request, Response>
      | 'transformSource'
      | 'transformMdx'
      | 'transformHtml',
  ): boolean
}

export interface PluginCssDefinition {
  cssFiles?: string[]
  headStyles?: string[]
  postcssPlugins?: unknown[]
  preprocessorOptions?: Record<string, unknown>
}

export interface PluginDefinition<
  Config = Record<string, unknown>,
  Request = unknown,
  Response = unknown,
> {
  name: string
  enforce?: 'pre' | 'post'
  version?: string
  boltdocsVersion?: string
  remarkPlugins?: unknown[]
  rehypePlugins?: unknown[]
  components?: Record<string, string>
  client?: PluginClientConfig
  metadata?: Record<string, unknown>
  css?: PluginCssDefinition
  middleware?: PluginTransformMiddleware<Config, Request, Response>[]
  hooks?: PluginLifecycleHooks<Config, Request, Response>
  codeHighlighter?:
    | CodeHighlighterAdapter
    | ((
        config: CodeHighlightConfig,
      ) => CodeHighlighterAdapter | Promise<CodeHighlighterAdapter>)
}
