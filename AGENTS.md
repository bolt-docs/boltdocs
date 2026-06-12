# Boltdocs Repository Agent Guide

## Repository Overview

Boltdocs is a monorepo documentation framework using Turborepo, pnpm workspaces, and Vite/React.

## Key Architecture

- **Monorepo structure**: `packages/core` (main package), `packages/create-boltdocs`, `packages/plugin-mermaid`, `packages/plugin-ssg`, `packages/plugin-image-optimizer`, `packages/plugin-math`
- **Package entrypoint**: `packages/core` - the main `boltdocs` package with CLI and core functionality
- **CLI command**: `boltdocs` (bin: `bin/boltdocs.js`)

## Development Commands

- `pnpm install` - Install dependencies (pnpm required)
- `pnpm run dev` - Start dev server (runs in `docs` package)
- `pnpm run build` - Full build via Turborepo
- `pnpm run build:core` - Build core package only
- `pnpm run test` - Run unit tests (vitest)
- `pnpm run test:coverage` - Tests with coverage
- `pnpm run lint:md` - Markdown linting
- `pnpm run format` - Code formatting (biome)

## Tooling

- **Package manager**: pnpm 10.30.2
- **Build system**: Turborepo
- **Testing**: Vitest with V8 coverage
- **Linting/formatting**: Biome
- **CLI framework**: cac (for command parsing)

## Testing Notes

- Tests in `tests/` directory via vitest
- Integration tests in `tests/integration/`
- Core tests in `packages/core`

## Release Process

- Uses Changesets for versioning
- Release workflow: `pnpm release` (builds then publishes)
- Main branch triggers automated releases

## Important Paths

- CLI: `packages/core/bin/boltdocs.js`
- Config: `boltdocs.config.ts` (user-facing)
- Docs source: `docs/` directory
- Packages: `packages/` directory

## SSG / Routing Architecture

- **Route generation**: `packages/core/src/client/ssg/create-routes.tsx` — builds route tree from doc metadata, creates relative child routes under parent `/docs`, and injects fallback redirect routes for base paths like `/docs`
- **SSG path collection**: `packages/plugin-ssg/src/node/utils.ts` (`routesToPaths`) — iterates routes and collects paths for SSG rendering. `path="."` (React Router's "same path as parent") is handled specially to produce the parent's path (e.g., `/docs`) instead of `prefix + "/."` (e.g., `/docs/.`)
- **SSG render adapter**: `packages/plugin-ssg/src/node/router-adapters/remix.tsx` (`RemixAdapter.render`) — uses `createStaticHandler` from react-router-dom for SSR
- **Redirect routes**: Fallback routes for `/docs` (and version/locale variants) reuse the first matched route's `element` and `loader` instead of using `<Navigate>` or `redirect()`. This avoids hydration mismatches and loader data key conflicts client-side
- **Key path rule**: `.` in React Router means "match the parent's URL path" — NOT a literal URL segment. SSG must account for this when mapping routes to static paths
