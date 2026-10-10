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

The target package graph is:

```text
@bdocs/contracts
  ├─ @bdocs/core-node
  ├─ @bdocs/runtime
  ├─ @bdocs/ssg
  ├─ @bdocs/processor-satteri
  └─ @bdocs/plugin-*
```

### Contracts

`@bdocs/contracts` will be small, framework-neutral, and dependency-light. It will define public types and interfaces for routes, manifests, plugins, build contexts, render contexts, module identities, and invalidation events.

Contracts must not import Node.js, Vite, React, SSG, or individual integrations.

### Core Node

`@bdocs/core-node` will own configuration resolution, route generation, frontmatter validation, plugin lifecycle, build orchestration, dev-server state, and invalidation. It will not import optional integrations such as Mermaid, Math, Ask AI, Search, RSS, or image optimization.

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
| 3 | UI extraction | `@bdocs/theme-neutral` | In progress |
| 4 | Primitives extraction | `@bdocs/primitives` | Done |
| 5 | Runtime boundary | `@bdocs/runtime` | Done |
| 6 | Incremental MDX and SSG | core, Sätteri, SSG | Partially delivered in 3.4.0 |
| 7 | Migration tooling and 4.0 release gate | repository-wide | Planned |

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
| Converted, both layers | 41 of 57 |
| Still on utility classes | **0 of 57** |
| Token dangling at computed-value time | 3 found, 0 left |
| Visual difference against the original | **not measured** — see below |

The denominator is the 57 files that actually carry a `class`/`className`
attribute, not every `.tsx` in the package. Counting the latter mixed in hooks,
contexts and utilities — files that never had a class — and reported 63 where the
real number was 23, which is what the guard itself says it was written to fix.

### What is still open in slice 3

Two things, both recorded rather than asserted:

**The visual harness has never been run on this conversion.** It is the only
thing that can prove the CSS did not move a pixel, and the machines this ran on
could not render it: `scripts/visual/` resolves `playwright` and `sharp` from the
root `package.json`, and neither was a dependency there. Both are now
dependencies (`playwright@1.59.1`, `sharp@0.34.5`), which is a real fix, and
`sharp` additionally needed its native build skipped to install at all. So the
comparison a conversion deserves has not happened, and the honest claim is
*nothing about the rendered pixels*.

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
  `@source "../packages/theme-neutral/src"` and `../packages/primitives/src`.
  It changes the UI on roughly 900 screenshots, and the harness is the thing that
  would have measured it, so "fixed" here means "the source is declared", not
  "the result is verified".
- Slice 3 is not a substitute for slice 7. An installable theme with a token API
  and no migration guide for the imports it replaces is half of what a breaking
  release owes its users. **Still open** — slice 7 is Planned.

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
| `packages/core` typecheck repaired | 2 | Correctness | `tsc --noEmit` on the core went from 1 error to 0 |
| **Audit test fixtures committed** | none | Correctness | 6 tests were failing on a tree with no local changes |

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

Six tests in `packages/core/tests/audit/` were failing on a clean tree with no
local changes, on both this branch and `4.0`. Not a flake and not a regression:
`packages/core/.gitignore` ignores `node_modules/`, which is right for every real
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

- `packages/contracts/tests/boundary.test.ts` fails if the package imports Node builtins, React, Vite, bundlers, worker pools, Sharp, sanitizers, optional integrations, or any other `@bdocs` package. A type-only import of a bundler type compiles and ships nothing while quietly welding the contract layer to the toolchain the separation exists to break. The test also asserts the package declares no runtime dependency at all.
- `packages/contracts/tests/contracts.test.ts` characterizes each contract shape, so a later slice that changes one is a deliberate diff rather than an accident.

### Slice 2 — Node and browser boundaries

Remove Node-only imports from runtime code and browser-only dependencies from the Node engine. Replace private cross-package imports with public contracts.

### Slice 3 — Plugin boundaries

Move integration-specific behavior behind the public plugin API. Keep default integrations available through explicit packages and configuration.

### Slice 4 — Incremental MDX and manifests

Introduce per-module identities and dependency edges. Preserve deterministic output and invalidation correctness while reducing the work performed for a single edited page.

### Slice 5 — Incremental SSG

Reuse safe client and server artifacts, avoid unnecessary SSR imports, and render only routes whose complete identity changed. Keep the page cache content-addressed and durable.

### Slice 6 — Migration tooling

Add codemods, compatibility adapters, migration diagnostics, and an upgrade guide for package imports, plugin APIs, configuration, and removed private entry points.

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
