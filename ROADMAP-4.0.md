# Boltdocs 4.0 Migration Roadmap

This document defines the migration strategy from the 3.x line to Boltdocs 4.0. The goal is not only a major version bump: we are separating the framework contracts, Node build engine, browser runtime, SSG pipeline, and optional integrations so Boltdocs can evolve without a monolithic core and so edited builds can invalidate only the work that actually changed.

The public-facing summary is published at the [Boltdocs 4.0 migration roadmap](/docs/releases/v4.0-roadmap).

## Release strategy

- `develop` remains the stable line for Boltdocs 3.4.0. It receives bug fixes, performance improvements, documentation updates, and compatible plugin work.
- `4.0` is the long-lived development line for breaking architecture and package-boundary changes.
- Temporary branches are created from `4.0` for each migration slice and merged back after tests and benchmarks pass.
- `develop` is merged into `4.0` periodically so fixes and security updates reach the next major line.
- The repository remains on `develop` after the 4.0 migration branch is created and synchronized.

## 3.4.0: preparation

The 3.4.0 release is the compatibility and optimization bridge. It will:

- stabilize the current Vite 8 and Sätteri pipeline;
- improve content-based SSG cache identities and edited rebuilds;
- keep all existing changesets on patch releases unless a breaking change is explicitly approved;
- introduce additive shared contracts without removing existing public APIs;
- document deprecations that will be removed or replaced in 4.0;
- keep integrations optional and avoid adding new framework internals to the public API;
- maintain the benchmark suite against Docusaurus Faster with cold, warm, edited, dev-startup, output, and memory measurements.

No 4.0-only package should be required for a normal 3.4.0 installation.

## 4.0 architecture

### Package naming

The published scope is `@bdocs/*`, matching every package on npm and in this
repository. The `@boltdocs/*` spelling that appeared in earlier drafts of this
document was never published and is not adopted: renaming the scope would be a
breaking change to every existing import for no functional gain. All new
packages in the graph below use `@bdocs/*`.

The engine keeps the name it has. Earlier drafts of this graph called it
`@bdocs/core-node`, and the name was never published: renaming the engine
would break every `import { createPlugin } from 'boltdocs'` in every plugin
and every site, and the graph exists to separate the *layers*, not to rename
the package that already sits at the bottom of them. The graph below is the
one that shipped.

```text
@bdocs/contracts   (no dependencies)
@bdocs/primitives  (no dependencies)
@bdocs/runtime     → @bdocs/contracts
@bdocs/theme-neutral → @bdocs/contracts, @bdocs/primitives, @bdocs/runtime
@bdocs/ssg         → @bdocs/contracts
boltdocs (engine)  → @bdocs/contracts, @bdocs/processor-satteri, @bdocs/ssg
```

#### Directories carry the `boltdocs-` prefix, package names do not

The two are separate namespaces and they answer different questions. The
directory answers "which project is this?" in a file tree, a CI path filter, a
`pnpm --filter` glob and a terminal. The package name answers "what do I
import?" and it is published — changing it breaks every site that already
depends on it. A directory can be renamed for free; a package cannot, which is
why the published scope stays `@bdocs/*` and the engine stays `boltdocs` while
their directories say what they are.

| Directory | Package name |
| --- | --- |
| `packages/boltdocs-engine` | `boltdocs` |
| `packages/boltdocs-contracts` | `@bdocs/contracts` |
| `packages/boltdocs-primitives` | `@bdocs/primitives` |
| `packages/boltdocs-runtime` | `@bdocs/runtime` |
| `packages/boltdocs-theme-neutral` | `@bdocs/theme-neutral` |
| `packages/boltdocs-ssg` | `@bdocs/ssg` |
| `packages/boltdocs-processor-satteri` | `@bdocs/processor-satteri` |
| `packages/boltdocs-grammars` | `@bdocs/grammars` |
| `packages/boltdocs-plugin-*` | `@bdocs/plugin-*` |
| `packages/boltdocs-create` | `create-boltdocs` |
| `packages/boltdocs-tsdown-config` | `tsdown-config` |

Before this, `packages/` held three different naming schemes at once — `core`,
`ssg`, `plugin-mermaid` next to `theme-neutral` — and `core` was the worst of
them: the folder named the layer, the package named the product, and neither
said the other. Reading a stack trace meant knowing both.

Two things a rename has to get right, and both are code, not `mv`:

- **Path lookups in TypeScript.** `join(ROOT, 'packages', 'primitives')` builds
the same string as `'packages/primitives/…'` and survives a text replacement
  that only knows the second form. Every hard-coded `packages/<name>` segment was
  hunted down, including the ones split across arguments.
- **Workspace links.** `pnpm install` re-links `node_modules` from the glob, so
  the tree is verified by resolving a `workspace:*` dependency afterwards rather
  than by trusting the rename.

`packages/tests` is deliberately untouched: it holds changelog fixtures, not a
package, and the prefix would claim it was one.

### Contracts

`@bdocs/contracts` will be small, framework-neutral, and dependency-light. It will define public types and interfaces for routes, manifests, plugins, build contexts, render contexts, module identities, and invalidation events.

Contracts must not import Node.js, Vite, React, SSG, or individual integrations.

### The engine

`boltdocs` owns configuration resolution, route generation, frontmatter
validation, plugin lifecycle, build orchestration, dev-server state, and
invalidation. It does not import optional integrations such as Mermaid, Math,
Ask AI, Search, RSS, or image optimization, and — as of the core cleanse — it
does not import the UI layer either. The theme is resolved from the project by
name and imported at build time, which is what makes a second theme a second
package rather than a fork of the engine.

### Runtime

`@bdocs/runtime` will own browser-facing React code, routing, hydration, navigation, theme primitives, and client contexts. It will not import filesystem, Vite, Piscina, Sharp, or server-only render code.

### SSG

`@bdocs/ssg` will consume public contracts and the documented core APIs. Client builds, server builds, SSR imports, critical CSS, render workers, output materialization, and page-cache policy remain in the SSG package.

### Integrations

Search, Mermaid, Math, Ask AI, image optimization, RSS, and LLMS integrations will be optional plugin packages. The core will provide lifecycle and transformation contracts, not hard-coded implementations.

## Incremental build plan

The major performance objective is to make an edited build proportional to the change:

1. hash the edited source and frontmatter;
2. recompile only the changed MDX document;
3. identify the route and its client, server, CSS, and plugin dependencies;
4. invalidate only the affected modules;
5. import or reuse the smallest safe SSR surface;
6. rerender only affected routes;
7. rewrite current entry and asset references for cached HTML.

The route cache identity will distinguish page content, frontmatter, shared runtime code, CSS, configuration, and plugin-generated artifacts. A text-only edit must not invalidate unrelated pages or synthetic routes.

## Current migration route

The migration is executed as an ordered sequence. Each slice is developed on a feature branch, verified in isolation, and merged into the long-lived `4.0` branch before the next slice starts.

| Order | Slice | Target package or area | Status |
| --- | --- | --- | --- |
| 1 | Shared contracts | `@bdocs/contracts` | Done |
| 2 | SEO extraction | `@bdocs/plugin-seo` | Done |
| 3 | UI extraction | `@bdocs/theme-neutral` | Done |
| 4 | Primitives extraction | `@bdocs/primitives` | Done |
| 5 | Runtime boundary | `@bdocs/runtime` | Done |
| 6 | Incremental MDX and SSG | core, Sätteri, SSG | Done |
| 7 | Migration tooling and 4.0 release gate | repository-wide | Done |

### Status of the core cleanse

The engine no longer ships the UI layer. That is the change with the widest
blast radius, and it is what the 4.0 package graph exists for.

- The client code — the route builder, the shell, the MDX page, the collection
  routes — moved from `packages/boltdocs-engine/src/client` to
  `packages/boltdocs-theme-neutral/src/ssg`. It depends on the theme's components, so
  the engine could not keep it without depending on a theme.
- `boltdocs` no longer exports `./client`, `./client/router`, `./primitives`
  or `./mdx`. What it publishes now is the engine: the CLI, the config, the
  route generation, the plugin lifecycle, the SSG bridge (`./ssg`) and the
  engine stylesheet (`./theme/reset.css`).
- The theme is resolved from the project, not from the engine. `themePackage`
  in the configuration names the package (default `@bdocs/theme-neutral`), and
  the engine imports the route surface from it. A second theme is a second
  package, not a fork of the engine.
- The generated per-site artifacts — icons, page source, search index, the
  site's layout, plugin slots, the site's MDX components — reach the theme
  through the runtime's site bridge, which the engine fills from a generated
  `virtual:boltdocs-site-bridge` module. The theme still mentions no virtual
  module, which is what lets it be installed on its own.
- The `boltdocs migrate` command splits a `boltdocs/client` import by name:
  every symbol goes to the package that exports it. It rewrites the import
  examples in Markdown too, and it adds the theme to the manifest.
- The documentation site, the `create-boltdocs` templates and the official
  plugins were migrated with that command — 116 files in the docs site alone.

The reset moved to the theme, and the engine ships no stylesheet at all.
`boltdocs/theme/reset.css` is now `@bdocs/theme-neutral/reset`, it reads the
theme's own tokens, and `boltdocs migrate` rewrites the import in a site's
stylesheets as well as in its code.

The evidence is a comparison of the two builds' stylesheets by their *resolved*
declarations — `scripts/benchmarks/compare-stylesheets.ts`, which reads two
built CSS files, resolves every custom property in both and compares what
results. A textual diff cannot answer "did it move a pixel": the same colour
is `var(--color-main)` in one file and `var(--bdocs-canvas)` in the other.

Ten differences remain, and nine are the same value written two ways. The tenth
is two rules the framework's own compiler was discarding: the line highlight's
coloured bar was compiled to `:after` — a pseudo-class, where the source said
`::after` — and the browser discards a rule with an invalid pseudo-class, so
the bar never rendered; and the line-number gutter lost its `display` and
`width` because two rules shared a selector and the compiler kept only the
last one's declarations. Both render now.

### The engine's stylesheet no longer assumes a CSS framework

`reset.css` was written with Tailwind's `@apply`: seventeen rules that only
compile inside a Tailwind build. That is the one CSS framework assumption
SPEC §2.1 forbids, and it was in the engine.

The declarations are the same ones Tailwind compiled to, written out by hand —
`py-2` is half a rem, `text-[12px]` is twelve pixels, `!bg-primary-500/10` is
`color-mix(in oklab, var(--color-primary-500) 10%, transparent)`. A test now
fails if a framework directive or a hardcoded colour comes back.

The evidence that nothing moved: the documentation site's compiled stylesheet
is **byte-identical** before and after the rewrite — 180,067 bytes either way.
No browser was involved; the comparison is between the two builds' CSS.

### Core is completely CSS-agnostic

SPEC §2.1 is now satisfied in the core: the engine and the neutral theme ship
no CSS framework assumptions, dependencies, preload, or auto-injection.

- `boltdocs` (engine) no longer depends on `@tailwindcss/vite`, `tailwind-merge`,
  or `clsx`, no longer dev-depends on `tailwindcss`, and no longer preloads the
  Tailwind Vite plugin; Vite/config wiring has no implicit Tailwind/SASS/UnoCSS.
- `@bdocs/theme-neutral` is plain CSS only: `src/utils/cn.ts` is
  framework-neutral (`clsx` class joining, no Tailwind conflict merging),
  `tailwind-merge` is removed, and the Tailwind `@theme` artifact
  (`src/neutral.css`) is gone in favor of the native token/stylesheet bundle
  (`@bdocs/theme-neutral/css`, `src/styles/*`).
- Base scaffolding (`create-boltdocs` base template) is CSS-agnostic out of the
  box; templates that use Tailwind opt in explicitly through
  `@bdocs/plugin-tailwindcss`. API/docs for `cn` and style composition were
  updated to match framework-neutral behavior.

CSS frameworks remain explicit, optional integrations: **Tailwind, Sass, UnoCSS,
and Lightning CSS** are available via `@bdocs/plugin-tailwindcss`,
`@bdocs/plugin-sass`, `@bdocs/plugin-unocss`, and
`@bdocs/plugin-lightningcss`. The Lightning CSS plugin enables Vite's
`lightningcss` transformer and ships unit plus Vite production-build integration
tests that verify modern CSS transforms are applied in emitted output.

### What the performance work found

Three changes, all measured on the documentation site (234 pages):

| | Before | After |
| --- | --- | --- |
| The theme's published main entry | 69,666 B | **4,277 B** |
| The app chunk | 653,989 B | **491,923 B** |
| The eager set, raw / gzip | 966.2 / 236.7 kB | **901.7 / 218.9 kB** |
| The whole client bundle | 5.586 MB | **5.524 MB** |
| The cold build | 27.4 s | **26.1 s** |

The route builder and the shell moved to their own entry
(`@bdocs/theme-neutral/ssg`): they are what the *build* drives, and every site
that imported one component was downloading them with it.

Two more findings, and what was done about them. The cold build of the
documentation site is now **17.3 s**, measured against the 27.4 s of the
table above.

### The critical-CSS extractor parses the stylesheet once

The extractor parsed the stylesheet on every page. Parsing is the expensive
half: on the documentation site's 180 kB stylesheet it costs 91 ms, and
matching it against one page costs 44 ms. The stylesheet is the same for every
page of a build, so the parse belonged to the build and the matching to the
page.

The stylesheet is now parsed once per extractor instance, and the tokenised
selectors — which were also rebuilt per page — are shared with it. The
extraction of one page went from **138 ms to 23 ms**, and the output is
**byte-identical**: the same 23,950 bytes of critical CSS, checked by
extracting the same page through both paths and comparing.

The cold build of the documentation site went from 24.7 s to 22.1 s, measured
back to back on the same machine with three runs each.

The change is in the Zig extractor (`packages/boltdocs-zig-critters`), which is
recompiled to WebAssembly as part of the build. The toolchain needs
`wasm-ld` on the path — on this machine it lives in `/usr/lib/llvm21/bin` —
and without it the WASM build fails and the previous binary is used.

### The extractor asks the page before it walks the elements

What is left of an extraction after the parse is the matching, and the
matching is a search: fifteen hundred rules tried against a thousand elements,
a million and a half attempts to answer a question that is almost always "no".
Almost all of them are hopeless before they start. A rule whose subject asks
for a class the page does not have cannot match, and the page knows it without
being asked element by element.

The extractor now builds a filter of the names the page has — every tag, class
and id, each kind kept apart — and a rule whose name is not in it is dropped
without touching the elements. The filter is a bitmap of hashes, not a set:
2^18 bits, 32 kB, filled by a page with a few thousand names to about two
percent. An absent name can still be reported as possibly present, which costs
the match it would have cost before; a present name is never reported as
absent, so no rule that could match is ever dropped.

| One extraction, 185 kB stylesheet | Before | After |
| --- | --- | --- |
| The documentation page | 53 ms | **12 ms** |
| The home page | 52 ms | **18 ms** |

The output is **byte-identical**: all 260 pages of the documentation site,
against the stylesheet the build actually produces, extracted through both
binaries and compared by hash.

In the build, the critical-CSS extraction went from 111 ms to 69 ms at the
median and the finalise queue from 113 ms to 78 ms. The cold build went from
18.1 s to 17.3 s.

### The build installs no browser it does not render in

Every build imported jsdom and constructed a document before it started. The
import alone costs 705 ms on this machine, and the window it installs was a
liability: with `window` defined, react-helmet believed it was running in a
browser and skipped the server branch of its state, which is why the theme
carries a flag that forces `canUseDOM` back to false for the duration of an
SSG render.

Nothing was using it. A production build renders its pages inside the SSG
worker pool, and those workers never installed a shim — the only jsdom lived
on the main thread, which imports the SSR bundle and hands the work over. The
documentation site renders all 260 pages without it, and the output is
byte-identical to the build that had a browser in memory.

| Cold build, config resolved → first bundle | jsdom | no jsdom |
| --- | --- | --- |
| The documentation site | 1589 ms | **486 ms** |

That segment is single-threaded, which is why it is the one quoted: the rest
of the build competes for the same four cores, and on a machine that was
carrying three other processes during these runs the whole-build medians
stayed inside their own spread. The 936 ms is real regardless of whether the
total is quiet enough to show it.

A project whose modules read `document` or `window` while they are imported
can ask for the shim back with `ssg.mock: true`. The dev server renders
in-process, so it keeps the shim unconditionally.

### Where the sixteen seconds are

The cold build of the documentation site, on a quiet machine, adds up like
this. The phases overlap where they can, which is why the numbers are a map
and not a sum.

| Phase | ms | Bound by |
| --- | --- | --- |
| Process start, config, plugin modules | ~1500 | modules loaded once per build |
| Vite config resolution inside the SSG | ~330 | every plugin's `config` hooks |
| MDX precompile, four workers | ~5900 | satteri: 15 s of CPU for 234 pages |
| Client and server bundle, in parallel | ~1400 | two Rolldown graphs |
| SSR bundle import on the main thread | ~600 | a 7 MB entry module |
| Render and critical CSS drain | ~3900 | React: 33 ms of SSR per page |
| Search index, redirects, outputs | ~1300 | — |

Two of those phases are worker-bound and account for ten of the sixteen
seconds: the precompile waits on MDX compilation, and the drain waits on
React rendering every page again. Neither has a configuration knob left —
four compile workers already lose to their own warm-up past that count, and
the render pool was swept against the critical-CSS pool. They move only if
the work per page gets cheaper.

The fixed overhead is smaller but matters more for a small site: ~2.4 s that
a hundred-page project pays in full. A ten-second build of a hundred pages
needs the precompile and the drain to shrink together, not the startup alone.

### The highlighter's engine is Oniguruma

Highlighting is 96% of an MDX compile — on the documentation site's 971 code
blocks it is 8.5 s of a 12.9 s compile. The engine was the JavaScript one, on
the strength of a startup cost that no longer held: the code claimed it cut
the engine build from ~2.5 s to ~200 ms, and measured today it is 548 ms
against 357 ms. The startup was the wrong cost to weigh.

| | Oniguruma | JavaScript |
| --- | --- | --- |
| Engine startup | 548 ms | 357 ms |
| One code block | 2.8 ms | 9.9 ms |
| 654 unique blocks | 1.8 s | 6.4 s |

A build pays the startup once and the blocks once per language, so the blocks
decide. The precompile went from 8.6 s to 6.6 s, and the build from 24.2 s
to 21.6 s — measured across three interleaved A/B builds.

Oniguruma is also the faithful engine: the JavaScript one degrades unsupported
grammar regexes to approximate matches, while Oniguruma matches TextMate
exactly. The two produce byte-identical output on the documentation site's
code blocks, and where they differ it is Oniguruma resolving a Markdown
front matter block as YAML, which is what it is.

### The highlighter's per-block preamble is gone

If highlighting is 96% of an MDX compile, then everything the highlighter does
*around* the grammar is paid 971 times to produce something that never changes.
It was rebuilding all of it per code fence:

| work per block | before | after | change |
| --- | --- | --- | --- |
| options (`getOptions`) | 1.8 µs | 0.5 µs | −74% |
| cache key | 10.2 µs | 0.1 µs | −99% |
| fence meta | 0.1 µs | 0.1 µs | −11% |
| runtime object | 0.3 µs | 0.8 µs | +185% |
| **preamble per block** | **12.5 µs** | **1.5 µs** | **−88%** |

The four transformers, the theme options, the runtime object and the meta
objects are now built once per adapter. The cache key stopped serializing the
resolved options — a `JSON.stringify` with a replacer that walked four
transformer objects and then concatenated the entire code block — because those
options are a function of a configuration that cannot change while the plugin
instance lives. The one line that got slower is the runtime object, which is
now one allocation per adapter instead of one per block; it is measured inside
a loop that calls it as if it were per block, which is the shape that got
slower and the shape that no longer happens.

`scripts/benchmarks/highlight-overhead.mjs` keeps the replaced implementation
verbatim and runs both under the same loop, against the built package rather
than a copy of it.

That is the end of the preamble, and measuring past it says where the floor is.
On a 39-line TypeScript block, `scripts/benchmarks/highlight-breakdown.mjs`:

```text
tokenizar            17.60 ms
+ árbol HAST         −0.88 ms   (bajo el ruido)
+ serializar HTML     2.52 ms
total                19.24 ms
```

**A light/dark theme pair doubles the tokenising**, and it is Shiki's design,
not a choice made here: `codeToTokensWithThemes` calls `codeToTokensBase` once
per theme, so the TextMate grammar runs twice for the same text.

| | tema único | par claro/oscuro |
| --- | --- | --- |
| Oniguruma | 9.7 ms | 18.1 ms |
| JavaScript | 10.0 ms | 21.4 ms |

The pair produces identical token boundaries from an identical grammar, so the
second run only needs colours. Collapsing the two means resolving that theme's
colours from every token's scope stack by hand — a reimplementation of TextMate
selector matching and its precedence rules, drifting with each Shiki upgrade, to
save 9 ms a block. Not done. A site that does not need two themes configures
one; the documentation site does, which is why its own numbers were always
single-theme.

**The MDX precompile is single-threaded for most sites.** It is 6.6 s of a
21.6 s build. The compile pool is skipped whenever the site registers a
remark or rehype plugin — which is most sites — because the workers cannot
run the user's plugins: they are functions, and a function does not cross a
worker boundary. The site cannot have a parallel precompile until the plugin
API can describe an MDX hook in a way a worker can rebuild. The documentation
site is in exactly that case (the Mermaid plugin transforms code blocks), and
its precompile runs on one core while seven sit idle.

**The plugin API can describe a hook for a worker to rebuild, and does.** A
plugin declares the module, the export and the options of its remark or
rehype hook, and the worker imports the module from the project — the way
the site's own code resolves it — and calls the export to obtain the same
plugin. The pool is used only when every user plugin that has an in-process
hook also declares a worker hook; a plugin that does not stays on the main
thread, because a worker that could not reproduce it would compile pages
differently from the main thread.

The compiled pages are byte for byte identical either way: the same 253
pages, compared file by file. Getting there took a fix in the highlight
cache, which is described below.

**The compile pool is a pessimisation on a small machine, and the reason is
the warm-up.** Measured on the documentation site: one core compiles the 234
pages in 9.8 s; a pool of eight workers takes 15.6 s. Each worker loads the
site's twenty grammars and compiles their regexes for itself, so the pool
spends 70 s of CPU where the single thread spends 10 s. The pool only pays
for itself on a site with few languages, or with pages big enough that the
warm-up is amortised over them.

The pool is therefore capped at four workers. Past four the duplicated
warm-up costs more than the parallelism buys: four workers compile the 234
pages in 5.4 s and eight in 8.4 s, while a single thread takes 6.4 s.

**The highlight cache could not tell two blocks apart.** It is keyed by the
language, the resolved options and the code. The resolved options carry the
fence meta — the title, the line numbers, the word wrap — but the meta's
properties are defined as non-enumerable, so `JSON.stringify` dropped them.
Two blocks with the same code and a different title shared one entry, and the
first one to be compiled lent its title to the other.

Which title a page showed therefore depended on the order the pages were
compiled in. The documentation site compiled the same page in two ways — on
the main thread and in a build worker — and the two disagreed about six code
blocks out of three thousand. The output was not wrong, but it was not the
same output either, and a build that is not reproducible is a build nobody
can cache. The cache key carries the fence meta now.

**The search dialog is in the eager set.** 110 kB — 12% of the first visit —
for a feature most readers never open. Vite preloads the entry chunk's dynamic
imports, and the search dialog is one: the navbar loads it with `lazy()`, but
the preload fetches it anyway. Not preloading it costs the reader a wait on
the first click, which is a trade-off and not a bug.

### The benchmark gate has a baseline, and knows what it measured

`scripts/benchmarks/baseline.json` did not exist, so the gate in SPEC §2.2
could never run: it wrote a baseline on the first invocation and had nothing to
compare against afterwards. There is one now, and it records the machine it
came from — the CPU model, the core count, the memory and the Node version.

A build time is a property of the machine as much as of the code, so the gate
compares only what it can compare. On the machine the baseline came from it
enforces the threshold; on another machine it says the comparison is not
meaningful and exits without a verdict, rather than failing a build on
hardware.

### The engine depends on nothing but the contracts

The package graph after the cleanse, measured from the manifests:

```text
@bdocs/contracts   (no dependencies)
@bdocs/primitives  (no dependencies)
@bdocs/runtime     → @bdocs/contracts
@bdocs/theme-neutral → @bdocs/contracts, @bdocs/primitives, @bdocs/runtime
@bdocs/ssg         → @bdocs/contracts
boltdocs (engine)  → @bdocs/contracts, @bdocs/processor-satteri, @bdocs/ssg
```

Three things closed the last gaps:

- **The `Boltdocs` global namespace moved to `@bdocs/contracts`.** It is
  augmented by the generated route types, and TypeScript rejects two
  `declare global` blocks for the same namespace, so it has exactly one home.
  It lived in `@bdocs/runtime`, which made the engine's re-export a type-only
  dependency on the browser half — one that compiles, ships nothing, and was
  therefore invisible in every install-size measurement. The contract layer
  cannot name React, so the MDX component map became a generic the runtime
  instantiates with `ComponentType`.
- **The engine declares no peer dependency at all.** It renders nothing:
  React, React DOM and the router are the browser half's business, and the
  browser half is a package the site installs. The engine's own tests need
  React, and it is now a dev dependency like any other.
- **The plugins read the contract types from the contracts.** `RouteMeta`,
  `SearchIndexParams` and `RouteContributor` come from `@bdocs/contracts`
  rather than from the engine. The engine-bound types — `PluginContext` and
  `BoltdocsPlugin`, which are the contracts' generics bound to the engine's
  config and to Node's request and response types — still come from the
  engine, because that binding is the value the plugin gets from it.

One coupling is deliberate and declared: `@bdocs/processor-satteri` reaches
the engine's runtime registries — the transform cache and the highlighter —
from the worker thread as well as the main one. The engine owns both, and the
worker resolves them from the engine it runs inside, so the processor declares
the engine as a peer. The undeclared-import audit fails without that
declaration, which is the point of the audit.

### Status of slice 3

Slice 3 was specified as extracting a package called `@bdocs/ui`. The package
that landed is `@bdocs/theme-neutral`, and the difference is not only the name.
An extracted UI *library* would have shipped the same Tailwind utility classes it
found in core and left every consumer needing a Tailwind build to render it. That
is a distribution change, not a boundary one.

`@bdocs/theme-neutral` therefore ships a stylesheet with it: a token layer of
plain custom properties and one CSS file per component. A theme a site can
install on its own, restyle by overriding tokens, and load from a plain `<link>`.

Conversion progress, measured against the build it replaces rather than asserted:

| Components | State |
| --- | --- |
| Converted, both layers | 46 of 57 |
| Still on utility classes | **0 of 57** |
| Tailwind Typography (`prose`) allowances | **0**, was 5 |
| Token dangling at computed-value time | 3 found, 0 left |
| Visual difference against the original | **not measurable on this site** — see below |
| Observable on the docs site | **0 of the 4** surfaces converted last |

The denominator is the 57 files that actually carry a `class`/`className`
attribute, not every `.tsx` in the package. Counting the latter mixed in hooks,
contexts and utilities — files that never had a class — and reported 63 where the
real number was 23, which is what the guard itself says it was written to fix.
The remaining eleven carry no class attribute at all.

The `prose` allowance is gone too, and that is the part that mattered. Tailwind
Typography's `prose`, `prose-neutral`, `dark:prose-invert`, `max-w-none` and
`not-prose` sat in four components — the default layout, `external-content`, the
callout and the timeline — and in the guard's allowlist, where a written reason
made them look considered. They meant the theme's *typography* still compiled
only inside a Tailwind build: the same framework assumption `reset.css` had
already had removed, three files away, in the layer a reader actually reads.

`prose.css` owns the rhythm now, under `.bdocs-prose`: element defaults for the
parts no MDX component renders (`em`, `del`, `kbd`, `figcaption`, `dl`, `dt`,
`dd`, `details`, `sub`/`sup`), and a tighter paragraph rhythm inside a callout
body, where the page's 20px margins are too tall for a 24px-padded panel. The
element rules sit before the class rules in the file and both are at zero
specificity, so `bdocs-prose-p` wins over `p` by source order and nothing needs
`!important`.

Four components were converted as part of closing this: `collection-list`
(`py-8 max-w-2xl mx-auto px-4`, `text-3xl font-bold`, `space-y-6`),
`external-content`, `external-page` and `shell-frame` — the collection index and
the external-page frame are the two screens a Tailwind-free install rendered
unstyled. `HEADING_CLASSES` in `mdx/typographics.tsx` was a dead utility map
(`Heading` never read it) and is deleted; heading sizes and rhythm belong to
`heading.css`, keyed on the primitive's `data-level`.

### What the measurement found

The harness was run against the built site (2026-11-01), and both halves ran
further than they ever had:

- **`styles.mjs` measured 120 selectors across 8 pages** in Chromium and wrote
  `.visual/after.styles.json`. One fix was needed to get there: this machine
  resolves a Playwright whose browser build (1217) is not the one in the cache
  (1248), so both scripts now accept `PW_EXECUTABLE` and `PW_CHANNEL` and
  otherwise launch the bundle exactly as before. Same class of problem as the
  missing `playwright` dependency, one layer down.
- **`snapshot.mjs` refuses to run, and correctly.** It aborts when a page's
  rendered `h1` is not the one it expects, because a screenshot of the wrong
  document is worse than no screenshot. The page it trips on is `index.html`,
  which hydrates to "Page Not Found" when served without the site's base path.
  That is a harness/deployment mismatch, not a styling one.

The larger finding is what those pages contain. **The docs site has replaced
every component this slice converted with its own**, so the premise the slice was
verified against — "the docs site is the only thing that renders the theme" — is
no longer true:

| Converted component | Who renders it on the docs site | Observable there |
| --- | --- | --- |
| `CollectionList` | `docs/docs/[blog]/list.tsx` | no — 0 `article`, 0 `bdocs-collection` |
| `ExternalPage`, `ExternalContent` | `pages-external/_sections/showcase-page.tsx` | no — the harness's `external column` target measures a 38px badge |
| `DocsLayout` (default) | `docs/src/theme/layout.tsx` | no |
| `Callout`, MDX typography | `docs/src/theme/mdx/*` | no |

Measured, not assumed: on `docs/blog.html` every collection selector in the
harness returns `null`, and on `showcase.html` the `external column` target
measures `rgb(102, 162, 255)` at 10px — a badge — instead of the 64rem reading
column. So these four conversions cannot be certified by this site at all, which
is also how they stayed in utilities while the guard reported progress: nothing
on the site could see them.

The honest claim is therefore narrower than "no pixel moved" and better founded
than it: **the conversion is verified by test and by compilation, not by pixels**
— 0 utility classes in 57 files, 14 guard tests, an empty allowlist, `tsc` clean,
a package build, and a browser run that proves the site renders. A pixel diff for
these four surfaces needs a page that renders them, and this repository does not
have one yet.

The second item recorded here, rather than asserted:

**Three tokens were declared, consumed, and never defined.**
`--_bdocs-brand-banner`, `--_bdocs-brand-ink` and `--_bdocs-brand-line` pointed
at public tokens that did not exist. A `var()` resolving to nothing makes its
whole declaration invalid at computed-value time without an error, so
`banner.css` was rendering with no colour, no background and no bottom border,
and the guard could not catch it because it only read the component
stylesheets. It now reads the private layer of `tokens.css` too. `--bdocs-primary-ink`,
`--bdocs-primary-banner` and `--bdocs-primary-line-soft` are defined, and the
banner renders as designed.

### The `:where()` rule, and the bug that produced it

Every base rule in these stylesheets is wrapped in `:where(…)`. That is
deliberate and it is documented at the top of `base.css`: the theme is a
*default*, and a default that beats the site's own CSS is not a default.

The conversion exposed the failure mode of taking that too far. Two rules, both
written the way that looks right:

```css
:where(.bdocs-toc__link):hover        /* 0-1-0 */
:where(.bdocs-toc__link[data-active]) /* 0-0-0 */
```

The attribute is inside `:where()`, so it contributes nothing; specificity
beats source order, so hover wins and the *active* table-of-contents entry turns
body-coloured under the pointer. The neighbouring form is worse because it
hides — both states inside the group are 0-0-0 and the later line wins, correct
by luck and one edit from being wrong.

`tests/native-styles.test.ts` enforces the rule that fixes both: `:where()`
wraps the root class and nothing that expresses state. A `--modifier` class is
allowed inside, because it is an alternative to the root rather than a state
layered on it. The test found 8 violations when it landed, 5 of them
preexisting.

### The two gaps that were open before this, and where they are now

- The docs' Tailwind `@source` covers `node_modules/boltdocs/dist` and the theme
  now lives in a workspace package outside it, so utilities used only inside the
  theme are never emitted. **Fixed** — `docs/index.css` adds
  `@source "../packages/boltdocs-theme-neutral/src"` and `../packages/boltdocs-primitives/src`.
  It changes the UI on roughly 900 screenshots, and the harness is the thing that
  would have measured it, so "fixed" here means "the source is declared", not
  "the result is verified".
- Slice 3 is not a substitute for slice 7. An installable theme with a token API
  and no migration guide for the imports it replaces is half of what a breaking
  release owes its users. **Still open** — slice 7 is Planned.

### Status of slice 6

Slice 6 is delivered on the 4.0 line. MDX compilation is incremental and
content-addressed: `@bdocs/processor-satteri` keeps an on-disk manifest and
compiled output cache keyed by source/content identity, reuses fresh entries,
invalidates per file, and precompiles/pre-renders highlight work with shared
caches so unchanged documents are not rebuilt. SSG rendering is incremental and
route-scoped: page cache entries are validated by per-route source content
hash, per-route asset hash, and shared client/server/CSS identity guards;
unchanged routes are materialized from cache (rewriting stale entry references
when safe), only invalid routes are rendered, and fully-cached builds can reuse
client/SSR/output artifacts and skip expensive phases. Route/output cache state
is reconciled against the active route set, so text-only edits do not
invalidate unrelated pages and removed routes do not linger in cached output.

### Status of slice 7

Migration tooling and upgrade documentation cover the supported 3.0→4.0 paths:
`boltdocs migrate` applies safe codemods (imports/subpaths/reset, manifest and
plugin wiring, search/SEO, custom `boltdocs-entry.*` site bridge) and reports
manual decisions with diagnostics and CI-friendly exit codes. The English and
Spanish upgrade guides document package-graph changes, moved APIs and manual
steps. The 4.0 release gate is prepared with contract/boundary/build test
coverage, incremental slice-6 behavior, and benchmark/gate tooling plus
baselines/scripts for cold/warm/edited/dev/output and scale measurements; final
release sign-off runs those measurements on the target environment and records
the results alongside release notes.

### Route rules

- `develop` remains the stable 3.4 line and never receives breaking architecture changes.
- `4.0` is the integration branch for the new package graph.
- Feature branches such as `refactor/contracts` and `refactor/plugin-seo` are created from `4.0`.
- `main` receives reviewed integration commits for repository visibility, but release automation is skipped until a release is explicitly approved.
- No changeset is created for 4.0 migration work while the migration is paused; changesets are added only when a release line is intentionally prepared.

### Work outside the slice sequence

Not every change to `4.0` belongs to a numbered slice. Two rounds of dependency work landed on `4.0` while the sequence was paused at slice 1, and they advance no slice's target package. They are recorded here so the branch's divergence from the table above is visible rather than silent.

| Change | Slice | Effect | Evidence |
| --- | --- | --- |
| `sharp` and `svgo` moved behind `experimental.imageOptimizer` | none | Install; opt-in rather than package split | Build with the flag off, core 1042 tests at the time |
| Shiki grammars and themes vendored, `shiki` dropped | none | Install, down 11.7 MB | 259 pages byte-identical; both regex engines covered by tests |
| Five documented code themes fixed | none | Correctness | Build with `theme: 'dracula'` emits the dracula palette |

| `@bdocs/primitives` replaces `react-aria-components` | 4 | Install: 1014.3 → 853.9 kB raw, 271.9 → 221.4 kB gzip | 259 pages byte-identical after normalising RAC internals; 5 rendering bugs found |
| `@bdocs/primitives` and `@bdocs/runtime` shrunk and minified | 4, 5 | Install: 90,138 → 45,640 B raw, 21,945 → 16,781 B gzip | 40 Playwright specs in Chromium; tree-shaking still 79 B for a single-export bundle |
| `@bdocs/runtime` created: router, contexts, i18n, view transitions | 5 | Boundary | Bundle unchanged at 853.7 kB, which is the point: a pure move. 12 inherited `any`s dropped |
| `@bdocs/theme-neutral` created with a native CSS token layer | 3 | Boundary, install | See the slice 3 section |
| `scripts/visual/` — pixel and computed-style harness | none | Verification | Found 4 defects in its own first conversion, including one that made it report zero differences over the wrong page |
| **Every bare import declared by its package** | 2, 3, 5 | Install, correctness | 15 undeclared imports across 5 packages, now 0 |
| `@bdocs/plugin-ssg` typecheck repaired | 5 | Correctness | `tsc --noEmit` on the package went from 10 errors to 0 |
| `packages/boltdocs-engine` typecheck repaired | 2 | Correctness | `tsc --noEmit` on the core went from 1 error to 0 |
| **Audit test fixtures committed** | none | Correctness | 6 tests were failing on a tree with no local changes |
| `PluginLifecycleManager` no longer loads the build pipeline | 2 | Dev startup, correctness | The `node/pipeline` barrel re-exported `createBuildPipeline`, so importing the step runner pulled in every build step, Vite and the SSG package. Module init for the plugin lifecycle: 3248 → 852 ms; the `routes:resolved` hook test file went from timing out on a loaded machine to 716 ms; core suite 1024/1024 |
| **Core `tsc --noEmit` regressed** | 2 | Correctness | The row above claims the core typecheck went from 1 error to 0. It is now 9 errors on a clean tree — `mdx/shiki-adapter.ts` (4), `plugins/search-contract.ts` (2), `search/registry.ts`, `plugin/index.ts`, `dev-server/index.ts`. The claim above is stale, and the drift is the same contracts/unist-utils type split the errors describe |

The pattern is worth naming: the roadmap's slice 3 and 4 extract packages, which reduces coupling but not install size, because the heavy parts follow their importers. Dependency trimming had to be done directly to move the number, and it turned out to be where two real bugs were hiding — an unreachable 308 grammars and five themes that were documented but never registered.

### The undeclared-import audit, and what it found

`scripts/check-undeclared-imports.mjs` answers one question: does the package
that imports a module declare it? Fifteen answers were no, and they had one
shape in common — they resolved here and nowhere else. pnpm's `node_modules` is
strict, so a package that imports something it does not declare is a package that
cannot be installed alone. Inside a monorepo its neighbours cover for it, which
is why the build stayed green while `@bdocs/theme-neutral` was uninstallable.

The one that actually broke a build: the theme imported `flexsearch`, `clsx`,
`tailwind-merge`, `dompurify`, `react-helmet-async` and
`scroll-into-view-if-needed` and declared none of them. A fresh install fails
with `Rolldown failed to resolve import "flexsearch"` from `theme-neutral/dist`,
three packages away from the cause.

Three more, all of which were worse than a broken build because they were not
broken:

- `boltdocs` imported `react-router-dom` in `boltdocs/client` without declaring
  it, so `tsc --noEmit` on the core failed on a clean tree.
- `@bdocs/plugin-ssg` took the `onLog` parameter types from `rollup` — a bundler
  it does not depend on, and does not run: Vite 8 is Rolldown. The types were
  wrong as well as undeclared. Rolldown's `onLog` takes **two** arguments, not
  Rollup's three, and suppresses by returning `false` rather than by calling a
  default handler. Calling the missing third argument throws on the first
  unsuppressed warning. The hook now derives its types from Vite's own
  declaration, which is also the version that cannot drift.
- `@bdocs/processor-satteri` reached into `boltdocs/node/cache` and
  `boltdocs/node/highlight` with no `boltdocs` dependency, behind a dynamic
  `import()`. Nothing failed at build time and everything failed at runtime.

The script uses TypeScript's scanner rather than a regex, because a regex
reported eleven findings in `processor-satteri` of which three were real: the
quote after the `from` keyword in `trimmed.indexOf(' from ')` has exactly the
shape of a module specifier. An audit that cries wolf protects nothing. The
allowlist is checked for staleness too — an exception that a package later
declares is reported, because an exception outliving its reason is a hole.

### The audit fixtures that were never committed

Six tests in `packages/boltdocs-engine/tests/audit/` were failing on a clean tree with no
local changes, on both this branch and `4.0`. Not a flake and not a regression:
`packages/boltdocs-engine/.gitignore` ignores `node_modules/`, which is right for every real
dependency and wrong for these four packages — `evil-plugin`, `clean-plugin`,
`sneaky-plugin` and the marker files they must never write are test inputs. The
fixture directory was empty, so the audit had nothing to read and reported every
plugin as unresolved.

They are committed now, with a local `.gitignore` that re-includes them. Two
things followed from writing them against the rules instead of against the
test's expectations. `fs-write` runs on the `raw` layer of the scanner, where
the string in `require('node:fs')` survives — so a destructured
`writeFileSync` is invisible to it, and the fixture has to write through the
binding. And `no-license`/`no-provenance` are not noise: a package with no
license and no repository is a real finding, so the clean fixture declares them.

`pnpm check:boundaries` runs the import audit.

A known item left deliberately unaddressed: `@shikijs/langs` is still installed through `@bdocs/plugin-ask-ai` → `streamdown` → `shiki`, which is the same 11.7 MB arriving through a third-party chat-markdown renderer. That is a `streamdown` decision, not a core one, and is not covered by any slice.

## Migration slices

### Slice 1 — Public contracts

Extract shared types without changing runtime behavior. Add compatibility re-exports and characterization tests before moving implementation code. The current work covers routes, plugin lifecycle, plugin definitions, highlighting, incremental identities, and framework-neutral configuration.

**Status: done.** `@bdocs/contracts` covers routes, plugin lifecycle and definitions, highlighting, search documents, framework-neutral configuration, module identities, and invalidation events, plus the build and render contracts this document names: bundle manifests, the server-side surface per route, the page cache entry, and the per-route cache identity. `@bdocs/ssg` consumes the manifest and cache contracts instead of declaring its own, which removes two copies that had already drifted.

Two properties are enforced by tests rather than by review, because both fail silently:

- `packages/boltdocs-contracts/tests/boundary.test.ts` fails if the package imports Node builtins, React, Vite, bundlers, worker pools, Sharp, sanitizers, optional integrations, or any other `@bdocs` package. A type-only import of a bundler type compiles and ships nothing while quietly welding the contract layer to the toolchain the separation exists to break. The test also asserts the package declares no runtime dependency at all.
- `packages/boltdocs-contracts/tests/contracts.test.ts` characterizes each contract shape, so a later slice that changes one is a deliberate diff rather than an accident.

### Slice 2 — Node and browser boundaries

Remove Node-only imports from runtime code and browser-only dependencies from the Node engine. Replace private cross-package imports with public contracts.

### Slice 3 — Plugin boundaries

Move integration-specific behavior behind the public plugin API. Keep default integrations available through explicit packages and configuration.

### Slice 4 — Incremental MDX and manifests

Introduce per-module identities and dependency edges. Preserve deterministic output and invalidation correctness while reducing the work performed for a single edited page.

**Status: done.** Delivered through `@bdocs/processor-satteri` disk/manifest caches, per-file invalidation and content-addressed reuse of compiled MDX artifacts (see Status of slice 6).

### Slice 5 — Incremental SSG

Reuse safe client and server artifacts, avoid unnecessary SSR imports, and render only routes whose complete identity changed. Keep the page cache content-addressed and durable.

**Status: done.** Delivered through content-addressed per-route page cache identities (source, assets, shared client/server/CSS surfaces), selective rerender/materialization, cache-hit entry rewriting and reusable client/SSR/output fast paths (see Status of slice 6).

### Slice 6 — Migration tooling

Add codemods, compatibility adapters, migration diagnostics, and an upgrade guide for package imports, plugin APIs, configuration, and removed private entry points.

**Status: done.** `boltdocs migrate` reports and fixes the supported 3.x→4.0 paths (react-aria/primitives, theme subpaths/reset, SEO/search plugins, package manifest, client import splits, and hand-written `boltdocs-entry.*` site-bridge registration), with fixable/manual diagnostics, dry-run/`--apply`, and tests. The upgrade guide covers the supported migration paths in English and Spanish. Release-gate infrastructure (build/package-boundary tests, benchmark baseline/gate tooling and scripts for cold/warm/edited/dev/output/memory-scale measurements) is in place for 4.0 sign-off.

Hand-written `boltdocs-entry.*` files are now covered by `boltdocs migrate` (it inserts `virtual:boltdocs-site-bridge` when missing), in addition to the generated entry.

## Branch and review workflow

- Keep `develop` free of breaking changes.
- Create feature branches from `4.0`, never directly from an uncommitted working tree.
- Keep commits small and independently testable.
- Require contract tests, package-boundary tests, build tests, and benchmark evidence for performance work.
- Merge `develop` into `4.0` after each stable 3.4 milestone.
- Do not publish 4.0 until the compatibility path, migration guide, and performance gates are complete.

## Definition of done for 4.0

The major release is ready when:

- the package graph has no private cross-package imports;
- optional integrations can be removed without breaking the core;
- browser and Node entry points have clean dependency boundaries;
- a single page edit recompiles and rerenders only affected work;
- cold, warm, edited-build, dev-startup, and output benchmarks meet the agreed targets;
- memory and worker behavior are measured at the 20, 100, and 259-page scales;
- migration tooling and upgrade documentation cover the supported paths;
- compatibility adapters are either documented or intentionally removed;
- the 4.0 release notes clearly list breaking changes and migration steps.

## Guiding principle

4.0 is a compatibility and performance milestone, not a reason to break working projects without a clear migration path. Every architectural boundary must reduce coupling, improve incremental builds, or make integrations independently maintainable.
