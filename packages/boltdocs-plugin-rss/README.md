# @bdocs/plugin-rss

Builds RSS and Atom feeds from your collection routes.

## Install

```bash
pnpm add @bdocs/plugin-rss
```

## Use

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import rssPlugin from '@bdocs/plugin-rss'

export default defineConfig({
  plugins: [
    rssPlugin({
  collections: ['blog'],
  limit: 30,
  format: 'both',
}),
  ],
})
```

## Docs

[Plugin guide](https://boltdocs.vercel.app/docs/plugins/content/plugin-rss)
