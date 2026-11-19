# `@bdocs/highlight`

The default syntax highlighter for Boltdocs. A small Prism-based adapter: no WASM, no TextMate grammars, and no code shipped to the browser. Highlighting runs at build time and the rendered HTML is stored in `data-highlighted-html`.

## Install

```bash
pnpm add @bdocs/highlight
```

Installed transitively by `boltdocs` — you only need it explicitly when registering the adapter yourself.

## Use

```ts
import { createHighlightAdapter } from '@bdocs/highlight'

const adapter = createHighlightAdapter({
  engine: 'highlight',
  theme: { light: 'github-light', dark: 'github-dark' },
})
```

The adapter emits semantic `bd-token-*` classes and no inline colors, so the theme stylesheet owns the palette. Language support is loaded on demand; unknown languages fall back to plain text.

To select this engine in a site, set `theme.codeHighlighting.engine: 'highlight'` (the default) in `boltdocs.config.ts`.

## Docs

[Configuration — code highlighting](https://boltdocs.vercel.app/docs/guides/getting-started/configuration)
