# `@bdocs/react-binding`

The React binding for Boltdocs: the client root and all React-specific Vite wiring (Fast Refresh, automatic JSX, dependency deduplication). It is the only supported binding today.

> **Resolved by name, never imported by the engine.** The engine sets `uiBindingPackage` (default `@bdocs/react-binding`) and loads the binding at build time, so the Node core never imports React. You do not write code against this package in a normal site.

## Install

```bash
pnpm add boltdocs @bdocs/theme-neutral @bdocs/runtime @bdocs/ui-base @bdocs/react-binding
```

## Use

The generated entry calls `createRoot`; a site only needs the package installed:

```ts title="boltdocs.config.ts"
export default defineConfig({
  uiBindingPackage: '@bdocs/react-binding', // default
})
```

| Subpath | Contents |
| --- | --- |
| `.` | `createRoot` |
| `./vite` | `reactBindingVitePlugin`, `PREWARM_ENTRIES` |

## Docs

[Configuration](https://boltdocs.vercel.app/docs/guides/getting-started/configuration)
