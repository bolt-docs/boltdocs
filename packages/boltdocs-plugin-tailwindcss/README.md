# @bdocs/plugin-tailwindcss

Adds Tailwind CSS v4 to a Boltdocs site through Vite. Optional — the default theme uses native CSS.

## Install

```bash
pnpm add @bdocs/plugin-tailwindcss
```

## Use

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import tailwindcssPlugin from '@bdocs/plugin-tailwindcss'

export default defineConfig({
  plugins: [
    tailwindcssPlugin(),
  ],
})
```

## Docs

[Plugin guide](https://boltdocs.vercel.app/docs/plugins/css/tailwindcss)
