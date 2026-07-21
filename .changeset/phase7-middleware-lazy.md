---
'boltdocs': minor
---

Phase 7 of the new plugin API: transform middleware pipeline and lazy slot
loading.

### Transform Middleware API

Plugins can now register standalone transform middleware via
`BoltdocsPlugin.middleware` or programmatically via `ctx.middleware.add()`.

Each middleware has its own `name` and optional `enforce` ordering (`pre` |
`post`). Middleware transform functions receive the same enriched params as
lifecycle hooks and support `__signal: 'skip'` / `__signal: 'break'`:

```ts
const plugin: BoltdocsPlugin = {
  name: 'my-plugin',
  middleware: [
    {
      name: 'my-plugin:html',
      transformHtml: async (_ctx, { html, path }) => {
        return { html: html.replace(/foo/g, 'bar') }
      },
    },
  ],
}
```

The `runMiddlewareChain()` method on `PluginLifecycleManager` collects
both statically-declared and programmatically-registered middleware, sorts
by `enforce`, and runs them in sequence. Each middleware gets a generic
`PluginContext` with all standard APIs (caches, diagnostics, paths, slots,
virtualModules).

### Slot Lazy Loading

Slot declarations now accept `lazy?: boolean`. When `true`, the slot
component is wrapped in `<Suspense>` with a pulse-animated fallback
placeholder. The `slotLazyFlags` parallel map is emitted alongside
`slotRegistry`, `slotConditions`, and `slotSsrFlags`:

```ts
const plugin: BoltdocsPlugin = {
  name: 'my-plugin',
  clientEntry: '@scope/plugin/client',
  slots: [
    { id: 'right-rail', export: 'HeavyWidget', lazy: true },
  ],
}
```

Lazy components are rendered inside `<Suspense fallback={<SlotFallback />}>`
in the default layout. The `SlotWithSSR` interface now carries a `lazy`
boolean field.

### Internal changes

- `packages/core/src/shared/types.ts` — `PluginTransformMiddleware`,
  `PluginMiddlewareAPI`, `lazy?: boolean` on `SlotDeclaration`,
  `middleware` field on `BoltdocsPlugin`, `middleware` field on
  `PluginContext`
- `packages/core/src/node/plugins/plugin-types.ts` — `middleware` on
  `SecureBoltdocsPlugin`
- `packages/core/src/node/plugins/plugin-context.ts` —
  `middlewareRegistry`, `createPluginMiddlewareAPI()`,
  `invalidateMiddlewareCache()`, reset helper updated
- `packages/core/src/node/plugins/plugin-lifecycle.ts` —
  `runMiddlewareChain()`, `createGenericContext()`, `middleware` wired
  into context factories
- `packages/core/src/node/plugin/layout-slots.ts` — `lazy` in
  `SlotDeclarationSchema`, emits `slotLazyFlags` parallel map
- `packages/core/src/node/schema/config.ts` — `lazy` and `middleware`
  added to config schemas
- `packages/core/src/client/hooks/use-slot-registry.ts` —
  `slotLazyFlags` import, `lazy` field on `SlotWithSSR`
- `packages/core/src/client/components/docs-layout-default.tsx` —
  `<Suspense>` wrapping for lazy slot items, `SlotFallback` component
- `packages/core/src/client/virtual.d.ts` — `slotLazyFlags` declaration
- `packages/core/tests/slots/layout-slots-generator.test.ts` — 3 new lazy
  flag tests
