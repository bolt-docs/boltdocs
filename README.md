<p align="center">
  <img src="assets/light.svg" width="20%" alt="Boltdocs" />
</p>

<h1 align="center">Boltdocs</h1>

<p align="center">
  <strong>Write MDX like you mean it, ship a site that feels instant, and never fight the tool for control.</strong>
</p>

<p align="center">
  <a href="#quick-start"><img src="https://img.shields.io/badge/Quick_Start-blue?style=flat-square" alt="Quick Start" /></a>
  <a href="https://boltdocs.vercel.app"><img src="https://img.shields.io/badge/Live_Demo-purple?style=flat-square" alt="Live Demo" /></a>
  <br />
  <a href="https://www.npmjs.com/package/boltdocs"><img src="https://img.shields.io/npm/v/boltdocs?style=flat-square" alt="npm version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="License" /></a>
</p>

---

## Quick Start

```bash
pnpx create-boltdocs@latest my-docs
cd my-docs
pnpm dev
```

The scaffold installs a working theme, so you get a styled site without configuration. Or add Boltdocs to an existing project:

```bash
pnpm add boltdocs @bdocs/theme-neutral @bdocs/runtime @bdocs/ui-base @bdocs/react-binding
mkdir docs && echo "# Hello World" > docs/index.md
```

> pnpm is the only supported package manager.

---

## 4.0 architecture

The core is a documentation **engine**. It ships only routing + SSG, the MDX pipeline, config + validation, and virtual modules. Everything else is an opt-in package or a plugin:

| Package | Purpose |
| --- | --- |
| `boltdocs` | Node-only engine: CLI, config, routes, plugins, Vite pipeline |
| `@bdocs/runtime` | Browser runtime: contexts, hooks, router, `BoltdocsShell` |
| `@bdocs/primitives` | Accessible, style-neutral UI behavior (no visuals, no CSS framework) |
| `@bdocs/ui-base` | Reusable composition wrappers and assembled UI with native CSS |
| `@bdocs/theme-neutral` | The default theme and the `surface` object the engine renders with |
| `@bdocs/react-binding` | The React binding (Fast Refresh, client root); resolved by name, not imported by the core |
| `@bdocs/ssg` | Client/server Vite builds, rendering, page cache |

CSS frameworks (Tailwind, SASS, UnoCSS, Lightning CSS), search, SEO, RSS, Mermaid, math and the rest are **plugins** — never hard dependencies of the core. See [SPEC.md](SPEC.md) for the contract.

Legacy `boltdocs/client`, `boltdocs/primitives` and `boltdocs/entry` specifiers were removed in 4.0; see the [upgrade guide](docs/docs/(guides)/operations/upgrading-4-0.mdx).

---

## Features

- **MDX is the source of truth** — frontmatter drives metadata, routes, collections and SEO; the Sätteri parser keeps code blocks, HTML, tables and custom components intact.
- **Fast by construction** — build-time Shiki highlighting, content-addressed caches, incremental rebuilds, and a gated 100-page benchmark.
- **i18n and versioning** — locale fallbacks, RTL, version URL prefixes and generated TypeScript types.
- **Accessibility without visuals** — primitives own focus traps, roving tabindex, typeahead and dismissal; the theme owns the CSS.
- **Opt-in everything** — experimental flags (`viewTransitions`, `fileRouting`) are off by default and off in the production docs.

MDX components come from the theme (`@bdocs/theme-neutral`); framework hooks come from `@bdocs/runtime`:

```mdx
import { Callout, Card, Cards } from '@bdocs/theme-neutral'

<Callout variant="info" title="Pro tip">
  This callout is styled by the theme.
</Callout>
```

---

## CLI

| Command | Description |
| --- | --- |
| `boltdocs dev` | Development server with HMR |
| `boltdocs build` | Production SSG build (runs the plugin security audit first) |
| `boltdocs preview` | Preview the production build |
| `boltdocs audit` | Static plugin security scan (fails on risky or unreviewed calls) |
| `boltdocs doctor` | Health checks for links, metadata and translations |
| `boltdocs migrate` | Import 3.x, Docusaurus or Starlight projects |
| `boltdocs changelog <file>` | Generate versioned changelog pages |

---

## Contributing

Read [SPEC.md](SPEC.md) before writing code or opening a PR. Every change is measured against it: performance is benchmarked, the core stays opinion-free, and legacy code is temporary.

- **Package manager**: pnpm only
- **Tests**: `pnpm test`
- **Format**: `pnpm run format`
- **Benchmarks**: `pnpm benchmark:fixture`, `pnpm benchmark:fixture:gate`, `pnpm benchmark:core`

## License

MIT — see [LICENSE](LICENSE).
