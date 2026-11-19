# @bdocs/plugin-search-pagefind

Indexes the static site with Pagefind after the build, producing a fully client-side search index.

## Install

```bash
pnpm add @bdocs/plugin-search-pagefind
```

## Use

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import pagefindSearchPlugin from '@bdocs/plugin-search-pagefind'

export default defineConfig({
  plugins: [
    pagefindSearchPlugin(),
  ],
})
```

## Docs

[Plugin guide](https://boltdocs.vercel.app/docs/integrations/search/pagefind)
