# `@bdocs/contracts`

Framework-neutral types and pure helpers shared by the Boltdocs engine, runtime and plugins. No Node, Vite or React imports — everything in the workspace can depend on this package, and it depends on nothing else in the workspace.

## Install

```bash
pnpm add @bdocs/contracts
```

Normally installed transitively by `boltdocs`. Add it explicitly when writing a plugin or a custom theme that needs the public types.

## Use

```ts
import type { BoltdocsConfigContract, RouteMeta } from '@bdocs/contracts'

function summarize(route: RouteMeta): string {
  return `${route.title} → ${route.path}`
}
```

The package also exports route sorting, collection date sorting and the shared `Plugin*` interfaces. It is types-and-helpers only: importing it never pulls in the engine or the browser runtime.

## Docs

[API reference](https://boltdocs.vercel.app/docs/api) · [Plugin API](https://boltdocs.vercel.app/docs/api/plugin-api)
