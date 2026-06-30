# @bdocs/parser

## 1.1.0

### Minor Changes

- [`1e726e1`](https://github.com/bolt-docs/boltdocs/commit/1e726e1993d401120a4611d41baf95b247ac34da) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **Single-pass parser mode** (`--turbo` only)
  - New `parseDocSinglePass()` function in Zig parser
  - Generates headings, plain text, and HTML in a single pass through the document
  - Shared `ParseContext` buffer reduces memory allocations
  - `stripAndDecodeInto()` and `slugInto()` for in-place processing

## 1.0.0

### Major Changes

- [`3cc3b45`](https://github.com/bolt-docs/boltdocs/commit/3cc3b451e59f533910b11fe69452f6d2720a2f0d) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: Boltdocs v3.0.0 - Native Parser, Vercel Analytics, Giscus, and More

  ## Native Parser Acceleration (@bdocs/parser)
  - Zig-compiled binary for markdown parsing with WASM fallback
  - 5-6x faster than JS parser (10.5x on 75-file dataset)
  - Cold start reduced from 3.67s to 349ms (90.5% reduction)
  - Cross-platform binaries: Linux x64/ARM64, macOS x64/ARM64, Windows x64
  - Auto-download via postinstall script from GitHub Releases

  ## Vercel Analytics + Speed Insights
  - Zero-config integration via `integrations.vercel.analytics` and `integrations.vercel.speedInsights`
  - Scripts injected only in production builds
  - Full documentation in English and Spanish

  ## Giscus Comment System
  - Complete component with theme sync (dark/light)
  - Configurable via `integrations.feedback.giscus`
  - Support for repo, category, mapping, reactions, custom themes
  - Full documentation in English and Spanish

  ## Custom Feedback System
  - GitHub Discussions-powered feedback
  - Middleware for dev/preview environments
  - Adapters for Vercel, Netlify, AWS, and Web platforms
  - Full documentation in English and Spanish

  ## Ask AI Plugin Overhaul
  - Complete handler and adapter rewrite
  - New sidebar panel + floating bubble UI
  - Dedicated MarkdownRenderer component
  - Comprehensive test suite (adapters, handler, Ollama integration)
  - SSE streaming with batching and AbortSignal support

  ## UI/UX Improvements
  - Card component: mouse spotlight effect
  - Navbar: Ask AI button integration
  - Search: Cmd+J shortcut, result highlighting
  - Tabs: SVG icon sanitization
  - Theme context: dual-package hazard fix
  - Breadcrumbs: typed routing

  ## SEO/Meta Improvements
  - OG image resolution with siteUrl
  - Canonical URLs
  - Structured SEO tags
  - Google search engine verification tags
  - Twitter card dynamic selection

  ## Cache System Refactor
  - TransformCache with LRU + gzipped shards
  - BackgroundQueue for async persistence
  - Image optimizer cache with stale pruning

  ## Dev Server/HMR Improvements
  - Link tree regeneration on file events
  - boltdocs:config-update custom event
  - Case-insensitive module invalidation

  ## Node 26+ Compatibility
  - DEP0205 warning suppression in CLI
