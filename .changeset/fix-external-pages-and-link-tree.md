---
'boltdocs': patch
---

Fix site-root external pages 404ing in `dev` when a `base` is configured, and fix link autocompletion dropping external and collection routes.

Vite is configured with the same `base` as Boltdocs, and Vite's base middleware answers every request outside that base with `404 The server is configured with a public base URL of /docs`. External pages are real routes that live at the site root by design (`/`, `/about`, `/roadmap`, `/showcase`), and the SSG already emitted them at the dist root, so production always served them while `dev` could not. The dev server now rewrites the internal URL of a known external path to its base-prefixed form before Vite's base check runs; the browser URL is untouched and the rendered HTML keeps using absolute `/docs/...` asset URLs.

The generated link tree and `types.d.ts` route list are now assembled by a single shared helper. Four call sites had each grown their own copy and a fifth in the dev server only passed the raw doc route paths, so `/roadmap`, `/showcase`, `/about` and `/docs` were missing from the generated tree and lost autocompletion. The shared helper also base-prefixes collection routes, whose metadata omits the base even though the SSG emits them under it, fixing entries like `/blog/post` being offered instead of `/docs/blog/post`. `generateProjectTypes` calls made during HMR no longer strip the `RoutePaths` augmentation, which previously wiped link autocompletion on any `mdx-components` edit or page addition until the next full run.
