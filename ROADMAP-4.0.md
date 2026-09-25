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

The target package graph is:

```text
@boltdocs/contracts
  ├─ @boltdocs/core-node
  ├─ @boltdocs/runtime
  ├─ @boltdocs/ssg
  ├─ @boltdocs/processor-satteri
  └─ @boltdocs/plugin-*
```

### Contracts

`@boltdocs/contracts` will be small, framework-neutral, and dependency-light. It will define public types and interfaces for routes, manifests, plugins, build contexts, render contexts, module identities, and invalidation events.

Contracts must not import Node.js, Vite, React, SSG, or individual integrations.

### Core Node

`@boltdocs/core-node` will own configuration resolution, route generation, frontmatter validation, plugin lifecycle, build orchestration, dev-server state, and invalidation. It will not import optional integrations such as Mermaid, Math, Ask AI, Search, RSS, or image optimization.

### Runtime

`@boltdocs/runtime` will own browser-facing React code, routing, hydration, navigation, theme primitives, and client contexts. It will not import filesystem, Vite, Piscina, Sharp, or server-only render code.

### SSG

`@boltdocs/ssg` will consume public contracts and the documented core APIs. Client builds, server builds, SSR imports, critical CSS, render workers, output materialization, and page-cache policy remain in the SSG package.

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

## Migration slices

### Slice 1 — Public contracts

Extract shared types without changing runtime behavior. Add compatibility re-exports and characterization tests before moving implementation code.

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
