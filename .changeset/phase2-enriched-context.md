---
'boltdocs': minor
---

Phase 2 of the new plugin API: enrich `PluginContext` with four
new APIs every lifecycle hook receives:

| New ctx field | Type | What it does |
| --- | --- | --- |
| `caches` | `PluginCachesAPI` | Functional wrappers around the core's `TransformCache`, `FileCache`, and a fresh per-namespace LRU. Never leaks implementation. |
| `diagnostics` | `PluginDiagnosticsAPI` | Structured `report()` channel — drain via `list()` from reporters/dev-server overlay/CI. |
| `paths` | `PluginPathsAPI` | `resolveDocs`, `resolveAsset`, `safeFileURL` — all reject paths that escape the workspace boundary. |
| `virtualModules` | `PluginVirtualModulesAPI` | Plugins declare `virtual:<plugin>/<id>` modules without authoring a full Vite plugin. The core Vite plugin loads them in a single dispatch path. |

### Migration for plugin authors

```ts
// Cache something without reaching into core internals
ctx.caches
  .transform('my-plugin-rewrites')
  .set('foo', 'bar')

// Surface a structured warning the dev server can render in an overlay
ctx.diagnostics.report(
  'warn',
  'MY_PLUGIN_CONFIG',
  'config.foo is missing — using the default',
  { filePath: ctx.docsDir + '/config.ts' },
)

// Avoid hand-rolled path joins
const link = ctx.paths.resolveDocs('assets', 'banner.png')

// Expose a custom virtual module to clients
ctx.virtualModules.add(
  'virtual:@my-plugin/runtime-config',
  () => `export default ${JSON.stringify({ ... })};`,
)
```

Plugin authors do NOT need any extra dependency — `ctx.*` is enriched
inside Boltdocs core.

### Internal changes (no public surface for users)

- `packages/core/src/node/plugins/plugin-context.ts` — new module
  implementing the four APIs.
- `PluginLifecycleManager.createContext()` — extended to inject them.
- `packages/core/src/node/plugin/virtual-modules.ts` — `resolveId` and
  `load` branches for plugin-declared virtuals. Two public exports
  added: `invalidatePluginVirtualModules()` (re-export of
  `invalidateVirtualModulesCache`).
- New `__resetPluginContextStateForTests()` test helper is exported
  from `plugin-context.ts` to clear diagnostic queue and
  plugin-virtual-map between test runs.

### Reserved namespace

Plugin virtual modules registered under the `virtual:boltdocs-` prefix
are rejected at registration time — the prefix is reserved for core.
Plugin authors should prefix their ids with the plugin name
(`virtual:@my-plugin/...` or `virtual:my-plugin-...`).

### Out of scope (called out, parked for a later phase)

- The `eager` flag on `add()` is accepted but not yet wired into the
  generated `boltdocs-entry.tsx`. Phase 7 (MDX transformer API) or a
  later Phase will pick it up to auto-inject plugin virtual imports.
- The diagnostics queue is process-local. For multi-instance
  deployments front it with a remote sink (file/process-tracker/
  OTEL). The interface stays stable across sinks.
