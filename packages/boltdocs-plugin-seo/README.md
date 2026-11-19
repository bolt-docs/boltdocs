# @bdocs/plugin-seo

Writes `sitemap.xml` and `robots.txt`, and enriches every route with SEO metadata.

## Install

```bash
pnpm add @bdocs/plugin-seo
```

## Use

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import seo from '@bdocs/plugin-seo'

export default defineConfig({
  plugins: [
    seo(),
  ],
})
```

Also exports `generateSitemap`, `generateRobotsTxt`, `enrichRouteSeo` and `writeSeoArtifacts` for programmatic use.

## Docs

[Plugin guide](https://boltdocs.vercel.app/docs/integrations/seo)
