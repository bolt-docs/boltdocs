# `@bdocs/primitives`

Hand-written, accessible UI primitives for Boltdocs. Structure, behavior and `data-*` state only — no colors, borders, sizes or CSS-framework utilities. The theme owns the visuals.

## Install

```bash
pnpm add @bdocs/primitives
```

Installed transitively by `@bdocs/theme-neutral`; add it explicitly when building a custom theme.

## Use

```tsx
import { Dialog, Tabs, Button } from '@bdocs/primitives'

<Dialog.Root>
  <Dialog.Trigger asChild><Button>Open</Button></Dialog.Trigger>
  <Dialog.Panel>...</Dialog.Panel>
</Dialog.Root>
```

State is exposed only while true (`data-active`, `data-open`, `data-selected`, …), so a theme can style it without matching utility classes. Includes focus management, roving tabindex, typeahead and dismissal — there is no `react-aria` dependency.

| Subpath | Contents |
| --- | --- |
| `.` | All primitives and their hooks |
| `./client` | Browser-only entry |

## Docs

[UI primitives](https://boltdocs.vercel.app/docs/theme/components) · [Theme primitives guide](https://boltdocs.vercel.app/docs/guides/customization/theme-primitives)
