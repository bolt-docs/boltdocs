# Plugin API Reference

Boltdocs 3.3.0 introduces a next-generation plugin API inspired by Astro's integration model, with full TypeScript inference, client UI slots, and a rich lifecycle hook system.

## definePlugin vs createPlugin

Use `definePlugin` for new plugins (strong TypeScript inference for options + hooks):

```ts
import { definePlugin } from 'boltdocs'

export default definePlugin<MyOptions>((options) => ({
  name: 'my-plugin',
  version: '1.0.0',
  client: {
    slots: { 'header:right': './components/Actions.tsx' },
  },
  hooks: {
    'frontmatter:transform'(ctx, { frontmatter, rawContent }) {
      return { ...frontmatter, readingTime: Math.ceil(rawContent.split(/\s+/).length / 200) }
    },
  },
}))
```

`createPlugin` is the legacy alias (supports both static objects and factory functions):

```ts
import { createPlugin } from 'boltdocs'

export default createPlugin({
  name: 'my-plugin',
  hooks: {
    'build:before': (ctx) => { ctx.logger.info('Building...') },
  },
})
```

---

## Plugin Structure

```typescript
interface BoltdocsPlugin {
  name: string                    // Required, must be unique
  enforce?: 'pre' | 'post'       // Plugin ordering within the pipeline
  version?: string                // Plugin version
  boltdocsVersion?: string        // Semver range for compatibility (validated at load)
  remarkPlugins?: unknown[]       // Remark plugins for MDX processing
  rehypePlugins?: unknown[]       // Rehype plugins for MDX processing
  vitePlugins?: VitePlugin[]      // Additional Vite plugins to inject
  components?: Record<string, string>   // Component name → file path (legacy)
  client?: PluginClientConfig     // Client-side UI slots, providers, MDX components, head
  metadata?: Record<string, unknown>    // Arbitrary plugin metadata
  css?: PluginCssConfig           // CSS files, PostCSS plugins, preprocessor options
  middleware?: PluginTransformMiddleware[]  // Static transform middleware
  hooks?: PluginLifecycleHooks    // Lifecycle hooks (build, dev, transform, search, etc.)
}
```

---

## Client Configuration (`client`)

```typescript
interface PluginClientConfig {
  /** Dynamic UI slot registrations (component file paths) */
  slots?: Record<string, string>
  /** Top-level React provider component file paths */
  providers?: string[]
  /** MDX component overrides & additions */
  mdxComponents?: Record<string, string>
  /** Head elements to inject into rendered HTML (<script>, <link>, <meta>, <style>) */
  head?: PluginHeadEntry[]
}
```

### Available UI Slots

| Slot ID | Location |
|---------|----------|
| `'header:left'` | Left side of navbar |
| `'header:right'` | Right side of navbar |
| `'search:dialog'` | Search dialog |
| `'sidebar:top'` | Top of sidebar |
| `'sidebar:bottom'` | Bottom of sidebar |
| `'page:before'` | Before page content |
| `'page:after'` | After page content |
| `'footer:top'` | Top of footer |
| `'footer:bottom'` | Bottom of footer |

### Head Entry Interface

```typescript
interface PluginHeadEntry {
  tag: 'script' | 'link' | 'meta' | 'style'
  attrs?: Record<string, string | boolean>
  content?: string
}
```

---

## Lifecycle Hooks

### Build Lifecycle

| Hook | Signature | Description |
|------|-----------|-------------|
| `'build:before'` | `(ctx) => void \| Promise<void>` | Before SSG starts |
| `'build:after'` | `(ctx) => void \| Promise<void>` | After successful production build |
| `'build:end'` | `(ctx) => void \| Promise<void>` | Process completion (success or error) |
| `'build:generate'` | `(ctx, { routes, outDir, siteUrl? }) => void \| Promise<void>` | Post-SSG asset generation (sitemaps, RSS, robots.txt, OG images) |

### Dev & Server Lifecycle

| Hook | Signature | Description |
|------|-----------|-------------|
| `'dev:before'` | `(ctx) => void \| Promise<void>` | Before dev server starts listening |
| `'dev:after'` | `(ctx) => void \| Promise<void>` | After dev server is fully initialized |
| `'server:configure'` | `(ctx, { server, middleware }) => void \| Promise<void>` | Configure HTTP middlewares and API endpoints (note: `server` is typed as `unknown` — cast as needed) |

### Transform Pipeline Hooks

These hooks form a **chain** — each plugin's output feeds into the next. Supports `__signal: 'skip' | 'break'` for chain control.

| Hook | Signature | Description |
|------|-----------|-------------|
| `'transform:source'` | `(ctx, { code, filePath, frontmatter? }) => { code, __signal? }` | Raw MDX source **before** MDX compilation |
| `'transform:mdx'` | `(ctx, { code, filePath, frontmatter? }) => { code, __signal? }` | Compiled MDX JavaScript **after** compilation |
| `'transform:html'` | `(ctx, { html, path, route? }) => { html, __signal? }` | Rendered HTML during SSG generation |

### Frontmatter & Route Hooks

| Hook | Signature | Description |
|------|-----------|-------------|
| `'frontmatter:transform'` | `(ctx, { frontmatter, filePath, rawContent }) => Record<string, unknown> \| void` | Intercept & enrich frontmatter (readingTime, wordCount, custom metadata) |
| `'routes:resolved'` | `(ctx, { routes }) => RouteMeta[] \| void` | After all routes are crawled, normalized, and sorted |

### Search Contract Hook

| Hook | Signature | Description |
|------|-----------|-------------|
| `'search:index'` | `(ctx, { documents, routes }) => unknown \| Promise<unknown>` | Standardized search index hook. Receives `SearchDocument[]` |

### Legacy Hook Aliases (Backwards Compatible)

Modern name | Legacy alias
------------|-------------
`'build:before'` | `beforeBuild`
`'build:after'` | `afterBuild`
`'build:end'` | `buildEnd`
`'dev:before'` | `beforeDev`
`'dev:after'` | `afterDev`
`'transform:source'` | `transformSource`
`'transform:mdx'` | `transformMdx`
`'transform:html'` | `transformHtml`

---

## SearchDocument Interface

```typescript
interface SearchDocument {
  id: string
  path: string
  title: string
  content: string
  headings: Array<{ level: number; text: string; id: string }>
  frontmatter: Record<string, unknown>
  locale?: string
  version?: string
}
```

---

## Chain Signals (`__signal`)

Transform hooks can control the chain execution:

- **`__signal: 'skip'`**: Stop processing this hook for the current item (remaining plugins still run)
- **`__signal: 'break'`**: Stop the entire chain immediately

```ts
transformMdx: async (_ctx, { code }) => ({
  code: code.replace(/foo/g, 'bar'),
  __signal: 'skip',
})
```

---

## Transform Middleware (`middleware`)

Plugins can declare middleware that runs in the transform pipeline alongside lifecycle hooks. Middleware supports `enforce` ordering (`pre` → normal → `post`).

### Static Middleware (Declared on Plugin)

```ts
export default createPlugin({
  name: 'my-transformer',
  middleware: [
    {
      name: 'add-footer',
      enforce: 'post',
      transformHtml(ctx, { html }) {
        return { html: html.replace('</body>', '<footer>© 2026</footer></body>') }
      },
    },
  ],
})
```

### Programmatic Middleware (Registered at Runtime)

```ts
hooks: {
  'build:before'(ctx) {
    ctx.middleware.add({
      name: 'live-transformer',
      transformSource(ctx, { code }) {
        return { code: code.replace(/old/g, 'new') }
      },
    })
  },
}
```

---

## Plugin Context API

Every lifecycle hook receives a `PluginContext`:

```typescript
interface PluginContext {
  readonly config: BoltdocsConfig       // Frozen config object
  readonly logger: PluginLogger         // info/warn/error/debug
  readonly store: PluginStore           // Namespaced key-value store
  readonly meta: PluginMeta             // { name, version, boltdocsVersion }
  readonly docsDir: string              // Absolute path to docs/
  readonly rootDir: string              // Absolute path to project root
  readonly outDir: string               // Build output directory (e.g., 'dist/')
  readonly routes: RouteMeta[]          // All generated documentation routes
  readonly caches: PluginCachesAPI      // Cache helpers
  readonly diagnostics: PluginDiagnosticsAPI  // Structured diagnostics channel
  readonly paths: PluginPathsAPI        // Path resolution helpers
  readonly virtualModules: PluginVirtualModulesAPI  // Virtual module registration
  readonly middleware: PluginMiddlewareAPI  // Middleware registration & query
  readonly hmr: PluginHmrAPI            // HMR file events & custom events
  readonly server: PluginServerAPI      // HTTP middleware & server lifecycle
}
```

### Context APIs Detail

#### Logger

```ts
ctx.logger.info('message')
ctx.logger.warn('warning')
ctx.logger.error(new Error('something broke'))
ctx.logger.debug('debug info')
```

#### Store (Namespaced Key-Value)

```ts
ctx.store.set('my-plugin', 'counter', 42)
const count = ctx.store.get<number>('my-plugin', 'counter')
const exists = ctx.store.has('my-plugin', 'counter')
```

#### Caches API

```ts
// Transform cache (sharded, hash-keyed, disk-backed)
const cache = ctx.caches.transform('my-plugin')
await cache.get('file-hash')      // async read
cache.set('file-hash', 'content')  // sync write
await cache.flush()                // force-flush to disk

// Routes cache (wraps the internal doc cache)
const route = ctx.caches.routes.get(filePath)
ctx.caches.routes.set(filePath, routeMeta)
ctx.caches.routes.invalidate(filePath)
ctx.caches.routes.invalidateAll()

// Memory cache (in-process LRU/FIFO with optional TTL)
const mem = ctx.caches.memory<MyType>('my-plugin', { max: 100, ttl: 60_000 })
mem.get('key')
mem.set('key', value)
mem.has('key')
```

#### Diagnostics API

```ts
ctx.diagnostics.report('warn', 'MY_CODE', 'Something is off', {
  filePath: '/path/to/file.md',
  routePath: '/docs/page',
})
const records = ctx.diagnostics.list()  // readonly DiagnosticRecord[]
ctx.diagnostics.clear()
```

#### Paths API

```ts
ctx.paths.resolveDocs('relative/path.md')  // Resolves inside docs directory
ctx.paths.resolveAsset('images/logo.png')  // Resolves inside project root
ctx.paths.safeFileURL('/abs/path/file')    // Build file:// URL
```

#### Virtual Modules API

```ts
ctx.virtualModules.add(
  'virtual:my-plugin/config',
  () => JSON.stringify({ mode: 'production' }),
  { eager: false },
)
ctx.virtualModules.has('virtual:my-plugin/config')  // true
ctx.virtualModules.list()  // readonly RegisteredVirtualModule[]
```

#### HMR API

```ts
// Register file event handlers
ctx.hmr.onFileAdd((filePath) => { /* handle add */ })
ctx.hmr.onFileChange((filePath) => { /* handle change */ })
ctx.hmr.onFileUnlink((filePath) => { /* handle unlink */ })
ctx.hmr.onFileEvent('add', (filePath) => { /* handle add */ })

// Send custom HMR events to connected clients
ctx.hmr.send('my-event', { someData: true })
```

#### Server API

```ts
// Register Connect-style HTTP middleware
ctx.server.use((req, res, next) => {
  if (req.url === '/api/status') {
    res.end(JSON.stringify({ status: 'ok' }))
    return
  }
  next()
})

// Register middleware scoped to a path prefix
ctx.server.useAt('/api/feedback', (req, res, next) => {
  // handle feedback endpoint
})

// Server lifecycle callbacks
ctx.server.onStart(() => { console.log('Server started') })
ctx.server.onEnd(() => { console.log('Server shutting down') })
```

#### Middleware API

```ts
ctx.middleware.add({
  name: 'my-mw',
  enforce: 'post',
  transformHtml(ctx, { html }) {
    return { html: html.replace('</body>', '<!-- modified --></body>') }
  },
})
ctx.middleware.remove('my-mw')
ctx.middleware.has('my-mw')
ctx.middleware.list()
```

---

## CSS Configuration (`css`)

```typescript
interface PluginCssConfig {
  cssFiles?: string[]               // CSS files to auto-inject into bundle
  headStyles?: string[]             // Inline CSS strings for HTML <head>
  postcssPlugins?: unknown[]        // PostCSS plugins to append
  preprocessorOptions?: Record<string, unknown>  // SASS/Less/Stylus options
}
```

Example — SASS plugin:

```ts
createPlugin({
  name: 'plugin-sass',
  css: {
    preprocessorOptions: {
      scss: { api: 'modern', additionalData: '@import "vars";' },
    },
  },
})
```

---

## Hook Execution Order

```
build:before / dev:before
  → frontmatter:transform
    → routes:resolved
      → transform:source (chain: pre → normal → post)
        → MDX compilation
          → transform:mdx (chain: pre → normal → post)
            → HTML rendering (SSG only)
              → transform:html (chain: pre → normal → post)
                → search:index
                  → build:generate
build:after / dev:after
build:end
```

---

## Plugin Validation

- Plugins are validated against a Zod schema (`BoltdocsPluginSchema`)
- Duplicate plugin names are rejected
- Version compatibility is checked via `semver.satisfies()` against `boltdocsVersion`
- Component paths are validated against traversal (`..` rejected)
- Plugin ordering: `pre` → normal → `post` (via `enforce` field)
- Virtual module IDs starting with `virtual:boltdocs-` are reserved for core

## Plugin Error Handling

```typescript
class PluginValidationError extends Error   // Validation failures
class PluginCompatibilityError extends Error // Version mismatch
class PluginHookError extends Error          // Hook execution failures
```
