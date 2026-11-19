# `@bdocs/theme-neutral`

The default Boltdocs theme. Supplies `surface` — the object the engine renders with — the assembled docs layout, the MDX components and the native stylesheet. Reusable UI lives in [`@bdocs/ui-base`](../boltdocs-ui-base) and accessible behavior in [`@bdocs/primitives`](../boltdocs-primitives); this package re-exports their public API for compatibility.

A theme is required: the generated entry imports `surface` from `<themePackage>/surface`, so a site without one fails with a missing dependency.

## Install

```bash
pnpm add boltdocs @bdocs/theme-neutral @bdocs/runtime @bdocs/ui-base @bdocs/react-binding
```

## Use

```ts title="boltdocs.config.ts"
export default defineConfig({
  themePackage: '@bdocs/theme-neutral', // default
})
```

```mdx
import { Callout, Card } from '@bdocs/theme-neutral'

<Callout variant="info" title="Tip">Styled by the theme.</Callout>
```

| Subpath | Contents |
| --- | --- |
| `.` | `surface`, `DocsLayout`, `DocPage`, MDX components |
| `./surface` | The engine's render surface |
| `./composition` | Backwards-compatible re-export of `@bdocs/ui-base/composition` |
| `./css`, `./reset` | Native stylesheet and reset |

For a different look, create your own package with the same exports and point `themePackage` at it.

## Docs

[Theme neutral](https://boltdocs.vercel.app/docs/theme/theme-neutral) · [Custom themes](https://boltdocs.vercel.app/docs/theme/custom-theme)
