# @bdocs/plugin-unocss

Adds the UnoCSS atomic engine to a Boltdocs site. Optional, like the Tailwind plugin.

## Install

```bash
pnpm add @bdocs/plugin-unocss
```

## Use

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import unocssPlugin from '@bdocs/plugin-unocss'

export default defineConfig({
  plugins: [
    unocssPlugin(),
  ],
})
```

## Docs

[Plugin guide](https://boltdocs.vercel.app/docs/plugins/css/unocss)
