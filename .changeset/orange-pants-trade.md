---
"boltdocs": minor
---

Feature:
- **`--turbo` mode** for `boltdocs build` — Sätteri-powered build pipeline with native WASM parsing, critical CSS extraction, and Shiki syntax highlighting
  - Available via CLI: `boltdocs build --turbo`
  - Native WASM MDX parser (satteri) replaces @mdx-js/rollup for faster compilation
  - Critical CSS extraction via zig-critters (WASM) removes unused CSS
  - Shiki syntax highlighting with dual light/dark themes
  - Remark/rehype plugin adapter layer supports standard unified plugins (e.g. mermaid)
  - Fallback to standard MDX compiler if satteri fails
- **Collections hooks API** — simplified hooks for collection data access
  - `usePosts(collection?)` — defaults to `"blog"`, returns all filtered posts
  - `usePost()` — reads current post from context inside `post.tsx`
  - `useRecentPosts(collection?, count?)` — defaults to `"blog"` with count of 5
  - Removed `useCollectionList` (was redundant)
- **Feature Flags & Drafts** — control page visibility per environment
  - `drafts` config: `{ visible?: boolean, environments?: string[] }` — control draft visibility
  - `featureFlags` config: `Record<string, boolean | string>` — define flags, pages declare required flags
  - Draft badge in navbar when viewing draft pages
  - `BOLTDOCS_DRAFTS=true` env var to force draft visibility

Fixed:
- **Locale switching bug**: Switching languages on collection pages (e.g., `/blog`) now correctly navigates to the localized version (e.g., `/es/blog`) instead of redirecting to `/docs`
- **Vercel analytics script fix**: `vercel.analytics` and `vercel.speedInsights` now default to `true` if not specified in config, preventing accidental omission of analytics scripts 
- Native parser binary path lookup now includes `bdocs-parser` as a local fallback
- Removed `build:wrapper` script from `zig-critters` package.json (was broken)
- Fixed `main` field in `zig-critters/package.json` to point to `wasm/index.mjs`
- **Critical regex fix**: `__staticRouterHydrationData` script removal regex was crossing `</script>` boundaries, eating the entire HTML structure (missing `<body>`, `</head>`, `id="root"`). Added negative lookahead `(?!<\/script>)` to prevent matching across script tags.
- **Locale bug fix**: `DefaultCollectionList` now uses `usePosts()` which filters by current locale/version instead of `useLoaderData()` which bypassed filtering
- **Turbo mode fixes**: Shiki syntax highlighting now produces correct HTML with merged class attributes; CSS parser handles escape sequences and edge cases in selectors; WASM memory model uses arena allocation for reliability
- **`--turbo` performance fixes**: Fixed 5 issues causing turbo+cache to be slower than default mode:
  - Server build now correctly skips when client code is unchanged (was always running)
  - `computeClientCodeHash` no longer scans monorepo directories (packages/, scripts/, etc.)
  - Beasties critical CSS engine now skipped in turbo mode (uses zig-critters only)
  - Config resolution no longer runs twice in build pipeline
  - Turbo flag now propagated through entire pipeline to `generateRoutes`