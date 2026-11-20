# @bdocs/plugin-unocss

## 1.0.0

### Minor Changes

- Vite 8.3.5, and only Vite 8.3.

### Patch Changes

- Every package type checks.
- Fixed a critical compatibility bug: the engine read the **monorepo root** package version (1.11.0) instead of its own (3.4.1) when checking plugin ranges.

## 0.0.3

### Patch Changes

- Maintenance fixes shipped alongside the Boltdocs 3.4.0 release line.

## 0.0.2

### Patch Changes

- Improve the CSS plugin integrations with Vite 8: Sass compiler options are forwarded to both SCSS and indented Sass, while UnoCSS automatically scans Boltdocs Markdown/MDX sources and supports its full Vite mode configuration.
