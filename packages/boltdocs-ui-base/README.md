# `@bdocs/ui-base`

Reusable UI for Boltdocs: composition wrappers over [`@bdocs/primitives`](../boltdocs-primitives), the assembled components (navbar, sidebar, search dialog, code block, …), their hooks and the native stylesheet. No Tailwind utilities — every rule is a real class in `src/styles/`.

> **Installed as part of the bundle.** It is resolved by the theme, not used as a standalone app framework. The default theme re-exports its whole public API.

## Install

```bash
pnpm add boltdocs @bdocs/theme-neutral @bdocs/runtime @bdocs/ui-base @bdocs/react-binding
```

## Use

```tsx
import { OnThisPage } from '@bdocs/ui-base/composition'
import { useTabs } from '@bdocs/ui-base'

<OnThisPage.Root>
  <OnThisPage.Tree headings={headings} />
</OnThisPage.Root>
```

| Subpath | Contents |
| --- | --- |
| `.` | Assembled UI, hooks and utilities |
| `./composition` | Style-neutral wrappers — theme them through `data-*` state |
| `./css` | Native CSS |
| `./reset` | Optional reset |

Framework hooks such as `useConfig` or `useRoutes` live in `@bdocs/runtime`, not here.

## Docs

[Components](https://boltdocs.vercel.app/docs/theme/components) · [Theme primitives](https://boltdocs.vercel.app/docs/guides/customization/theme-primitives)
