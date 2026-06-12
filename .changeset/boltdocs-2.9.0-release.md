---
"boltdocs": minor
"create-boltdocs": minor
"@bdocs/plugin-image-optimizer": minor
"@bdocs/plugin-mermaid": patch
---

- **boltdocs (Minor)**:
  - Extracted the `@bdocs/dui` toolkit as a standalone terminal UI package.
  - Added native feedback integrations supporting Vercel, Netlify, and AWS Lambda adapters.
  - Supported the new `transformSource` plugin lifecycle hook for custom Remark/Rehype preprocessing.
  - Added new CLI dev server flags: `--port`, `--host`, and `--force`.
  - Implemented Phase 0 performance optimizations: deduplicated dev config resolution, instant dev server prewarming, pre-loaded Shiki highlighter during plugin configuration, and added debounced `TransformCache` index persistence.
  - Fixed collection routes provider wrapping at the global shell level, corrected `cover` frontmatter fallbacks, and updated outdated collections hook documentation examples.

- **create-boltdocs (Minor)**:
  - Completed a full rewrite of the scaffolding CLI templates using the `@bdocs/dui` terminal package.
  - Added integration setup helpers and automated deployment adapters.

- **@bdocs/plugin-image-optimizer (Minor)**:
  - Added the `@bdocs/plugin-image-optimizer` package to automatically optimize and cache WebP/SVG/PNG assets during static build compilation.

- **@bdocs/plugin-mermaid (Patch)**:
  - Performance optimizations to prevent Mermaid scripts from blocking client rendering.
