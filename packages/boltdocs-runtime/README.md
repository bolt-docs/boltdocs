# `@bdocs/runtime`

The browser-facing half of Boltdocs: contexts, hooks, the router entry and `BoltdocsShell`. No filesystem, Vite, Piscina or server-only code — it runs in the browser and during SSR.

> **Installed as part of the bundle.** This package does not build a site on its own; the engine generates the routes and the theme supplies the surface. Install it alongside `boltdocs` and the UI packages.

## Install

```bash
pnpm add boltdocs @bdocs/theme-neutral @bdocs/runtime @bdocs/ui-base @bdocs/react-binding
```

## Use

```tsx
import { useConfig, useLocalizedTo, useRoutes } from '@bdocs/runtime'

function Breadcrumb() {
  const config = useConfig()
  const to = useLocalizedTo()
  const { routes } = useRoutes()
  return <a href={to('/docs/guides')}>{config.site.title}</a>
}
```

| Subpath | Contents |
| --- | --- |
| `.` | Contexts, hooks, collections and the site bridge |
| `./app` | `createRoutes`, `BoltdocsShell`, route components |
| `./router` | Router entry and navigation helpers |

## Docs

[Hooks reference](https://boltdocs.vercel.app/docs/api/hooks/use-config) · [Configuration](https://boltdocs.vercel.app/docs/guides/getting-started/configuration)
