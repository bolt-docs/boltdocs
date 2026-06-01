---
"boltdocs": minor
---

- **Route-level code splitting**: MDX pages are now lazy-loaded on demand client-side using dynamic imports, with background prefetching in idle time and parallelized compilation pre-warming.
- **Diagnostic performance budgets**: Added checks for bundle and page HTML sizes, image/font counts, and build times under a new `checks.performance` configuration in `doctor.json`, run via `boltdocs doctor --budget`.
- **Plugin system simplification & safety**: Removed complex dynamic sandboxes and the `permissions` configuration. Added chain-pattern MDX/HTML transformation hooks (`transformMdx` and `transformHtml`), simplified available lifecycle hooks, and automated file-system access containment warnings.
- **Strict route path typing**: Introduced compiler-generated route path maps to support type-safe autocomplete for navigation navbar/sidebar definitions and custom Link components.
- **Directory caches reorganised**: Re-structured `.boltdocs/` internal metadata caches into specific `build/`, `cache/`, `generated/`, and `reports/` subdirectories.
- **Codeblock destructuring & plugin utils**: Refactored traversal helper functions to run across generic AST formats. Fixed React DOM warnings on code block node attributes.
- **Bug Fix**: Fixed a config loader exception by correctly exporting `MDX_NODES` from the core entry point.
- **Miscellaneous improvements**: Configured `react-router-dom` in server-side bundling to prevent SSR load exceptions, added horizontal overflow scrolling for tabs, and improved mobile layout padding.
