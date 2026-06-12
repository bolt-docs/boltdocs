---
name: boltdocs
description: Guidelines for developers using the Boltdocs documentation framework. Covers configuring boltdocs.config.ts, writing markdown/MDX content, directory routing layouts, and custom theme overrides.
---

# Boltdocs Agent Guidelines

This directory establishes standards and blueprints for developers creating, extending, or maintaining a documentation project built on top of the **Boltdocs** framework.

## When to Apply

Use these guidelines when:
- Writing or refactoring configuration inside `boltdocs.config.ts`.
- Adding new documentation sections, pages, or folders under `docs/`.
- Overriding HTML markdown tags or registering global React components in `mdx-components.tsx`.
- Styling the documentation theme colors or adding custom CSS rules.
- Writing MDX page content and using built-in components like `<Callout>`, `<Card>`, or Mermaid diagrams.

## Reference Guides

Read the following documents in the `references/` directory for detailed specifications:

1. **[Configuration Guide](references/configuration.md)**
   - Customizing `boltdocs.config.ts` using `defineConfig`.
   - Managing site options, navbar structure, version control, and SEO.
2. **[Routing & Directories](references/routing.md)**
   - File-system based page discovery.
   - Configuring sidebar ordering, collapsible groups, and icons via `meta.json` files.
3. **[Built-in & Custom Components](references/components.md)**
   - Using premium React components in MDX (Callouts, Card carousels, Mermaid.js blocks).
   - Injecting global components and customizing HTML tags via `mdx-components.tsx`.
4. **[Styling & Theme Customization](references/styling.md)**
   - Customizing colors and dark-mode parameters via CSS variables.
   - Writing custom variant directives compatible with styling linters.
