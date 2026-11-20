# `boltdocs`

The Node-only documentation engine: routing + SSG, the MDX pipeline, config + validation, and virtual modules. It does not ship a UI framework, a CSS framework, a theme, or the client runtime — those are separate opt-in packages.

## Install

```bash
pnpm add boltdocs @bdocs/theme-neutral @bdocs/runtime @bdocs/ui-base @bdocs/react-binding
```

`create-boltdocs` installs this set for you. The theme package is resolved by name from `themePackage`; the React binding is resolved from `uiBindingPackage` (default `@bdocs/react-binding`). The engine never imports React directly.

## Use

```bash
boltdocs dev      # development server
boltdocs build    # production SSG build (runs the plugin audit first)
boltdocs preview  # preview the build
```

Configuration lives in `boltdocs.config.ts`; see the [configuration guide](../../docs/docs/(guides)/getting-started/configuration.mdx). MDX components come from `@bdocs/theme-neutral`, framework hooks from `@bdocs/runtime`, and style-neutral behavior from `@bdocs/primitives`.

The full contract for what belongs in this package is [SPEC.md](../../SPEC.md).
