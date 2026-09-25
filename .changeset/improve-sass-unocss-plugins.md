---
'@bdocs/plugin-sass': patch
'@bdocs/plugin-unocss': patch
---

Improve the CSS plugin integrations with Vite 8: Sass compiler options are forwarded to both SCSS and indented Sass, while UnoCSS automatically scans Boltdocs Markdown/MDX sources and supports its full Vite mode configuration. Their tsdown configs also use the current `deps.neverBundle` API without deprecated `external` options.
