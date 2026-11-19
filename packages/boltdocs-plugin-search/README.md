# @bdocs/plugin-search

Generates the search index (`search.json`) from pages and headings. The default search provider for Boltdocs.

## Install

```bash
pnpm add @bdocs/plugin-search
```

## Use

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import searchPlugin from '@bdocs/plugin-search'

export default defineConfig({
  plugins: [
    searchPlugin(),
  ],
})
```

For Algolia or Pagefind, use the corresponding provider plugin instead.

## Docs

[Plugin guide](https://boltdocs.vercel.app/docs/integrations/search)
