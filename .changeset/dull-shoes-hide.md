---
"boltdocs": "patch"
---

fix(seo): inject `config.seo` tags into global HTML template and move `<Head>` to root shell

The homepage `/` was missing SEO tags from `config.seo` (og:image, custom metatags, etc.) because:

1. `injectHtmlMeta` only used `config.theme` values and ignored `config.seo` entirely — now it emits og:image, twitter:image, custom metatags, and robots meta from the seo config.

2. The `<Head>` component (which produces page-specific SEO via react-helmet-async) was only rendered inside `<DocsLayout>`, which only wraps routes under `baseDocsPath` (e.g. `/docs`). Moved `<Head>` up to `BoltdocsShell` so it covers all routes including external pages, collection pages, and the catch-all route.
