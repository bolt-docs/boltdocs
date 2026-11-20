# @bdocs/plugin-mermaid

## 0.6.0

### Minor Changes

- Vite 8.3.5, and only Vite 8.3.
- A user plugin's MDX hook can be rebuilt in a build worker, so a site with one keeps its parallel MDX compile.

### Patch Changes

- The engine no longer ships the UI layer.
- Fixed a critical compatibility bug: the engine read the **monorepo root** package version (1.11.0) instead of its own (3.4.1) when checking plugin ranges.

## 0.5.0

### Minor Changes

- Pre-render Mermaid diagrams in dev mode and refresh package metadata and build configs.

## 0.4.0

### Minor Changes

- Fix mermaid pages having extra scroll space at the bottom

## 0.3.1

### Patch Changes

- - **boltdocs (Minor)**:

## 0.3.0

### Minor Changes

- - **Dynamic lazy loading**: Refactored the core library import to load Mermaid dynamically only when a page contains diagrams, optimizing the client bundle size.

### Patch Changes

## 0.2.2

### Patch Changes

- Replace node-side `console.warn` with `warn()` from `@bdocs/dui`. Client-side error logging in `Mermaid.tsx` left unchanged (browser context, dui is node-only).

## 0.2.1

### Patch Changes

- - **fix**: Updated variables-css

## 0.2.0

### Minor Changes

- Support theme dark/light Support error rendering

## 0.1.1

### Patch Changes

- fix: reduce space packages

## 0.1.0

### Minor Changes

- support new API the Boltdocs plugins

### Patch Changes

- added types boltdocs

## 0.0.2

### Patch Changes

- fix: updated name plugins and support error
