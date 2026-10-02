---
"boltdocs": major
"@bdocs/plugin-seo": minor
---

Move sitemap, robots.txt and route SEO metadata into `@bdocs/plugin-seo`.

Until 4.0 the core wrote `sitemap.xml` and `robots.txt` itself, so every site had them. Those two files and the per-route SEO enrichment now live in `@bdocs/plugin-seo`. Add it to your config:

```ts
import seo from '@bdocs/plugin-seo'

export default defineConfig({
  siteUrl: 'https://example.com',
  plugins: [seo()],
})
```

The core warns during the build when it finds `siteUrl`, `robots` or `seo` configured but no SEO plugin, so a site that upgrades without adding it is told rather than silently losing its sitemap.

Two things had to change for a plugin to be able to do this work at all:

- **`build:routes`** is a new plugin hook that fires after routes are generated and before the SSG render. It is the only window in which a plugin can influence what gets rendered, which route SEO enrichment needs in order for `canonical` and `og:url` to be present in the HTML.
- **`build:generate` no longer lives inside the SEO step.** It used to be the tail of `SEOWriteStep`, so `@bdocs/plugin-rss` depended on an SEO step it had nothing to do with, and the hook was unreachable for anyone not using SEO. It has its own `Generate` step now.

The JSON-LD factories (`createArticleStructuredData` and friends) moved to `@bdocs/contracts`, which is where pure framework-neutral code belongs, and `boltdocs` and `boltdocs/client` keep re-exporting them. They are not part of the plugin: reaching them through an optional plugin would make it look like the plugin is required to use them.

Also fixes a `robots.txt` bug: a site listing its own sitemap under `robots.sitemaps` got a duplicate `Sitemap:` line, because the implicit entry and the explicit list were both emitted.
