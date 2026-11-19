# @bdocs/plugin-search-algolia

Pushes Boltdocs search records to an Algolia index at build time.

## Install

```bash
pnpm add @bdocs/plugin-search-algolia
```

## Use

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import algoliaSearchPlugin from '@bdocs/plugin-search-algolia'

export default defineConfig({
  plugins: [
    algoliaSearchPlugin({
  appId: process.env.ALGOLIA_APP_ID!,
  adminApiKey: process.env.ALGOLIA_ADMIN_KEY!,
  indexName: 'docs',
}),
  ],
})
```

The admin key is build-time only and never reaches the client. Use `dryRun: true` to validate without writing.

## Docs

[Plugin guide](https://boltdocs.vercel.app/docs/integrations/search/algolia)
