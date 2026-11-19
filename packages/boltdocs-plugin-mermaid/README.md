# @bdocs/plugin-mermaid

Turns ```mermaid fences into theme-aware diagrams. Diagrams are pre-rendered in a local worker at build time.

## Install

```bash
pnpm add @bdocs/plugin-mermaid
```

## Use

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import mermaidPlugin from '@bdocs/plugin-mermaid'

export default defineConfig({
  plugins: [
    mermaidPlugin({
  themes: { light: 'default', dark: 'dark' },
}),
  ],
})
```

Import `@bdocs/plugin-mermaid/style.css` in your stylesheet.

## Docs

[Plugin guide](https://boltdocs.vercel.app/docs/plugins/content/plugin-mermaid)
