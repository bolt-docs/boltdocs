# @bdocs/plugin-seo

## 2.0.0

### Minor Changes

- 3007d0b: Move sitemap, robots.txt and route SEO metadata into `@bdocs/plugin-seo`.

  Until 4.0 the core wrote `sitemap.xml` and `robots.txt` itself, so every site had them. Those two files and the per-route SEO enrichment now live in `@bdocs/plugin-seo`. Add it to your config:

  ```ts
  import seo from "@bdocs/plugin-seo";

  export default defineConfig({
    siteUrl: "https://example.com",
    plugins: [seo()],
  });
  ```

  The core warns during the build when it finds `siteUrl`, `robots` or `seo` configured but no SEO plugin, so a site that upgrades without adding it is told rather than silently losing its sitemap.

  Two things had to change for a plugin to be able to do this work at all:
  - **`build:routes`** is a new plugin hook that fires after routes are generated and before the SSG render. It is the only window in which a plugin can influence what gets rendered, which route SEO enrichment needs in order for `canonical` and `og:url` to be present in the HTML.
  - **`build:generate` no longer lives inside the SEO step.** It used to be the tail of `SEOWriteStep`, so `@bdocs/plugin-rss` depended on an SEO step it had nothing to do with, and the hook was unreachable for anyone not using SEO. It has its own `Generate` step now.

  The JSON-LD factories (`createArticleStructuredData` and friends) moved to `@bdocs/contracts`, which is where pure framework-neutral code belongs, and `boltdocs` and `boltdocs/client` keep re-exporting them. They are not part of the plugin: reaching them through an optional plugin would make it look like the plugin is required to use them.

  Also fixes a `robots.txt` bug: a site listing its own sitemap under `robots.sitemaps` got a duplicate `Sitemap:` line, because the implicit entry and the explicit list were both emitted.

### Patch Changes

- Fixed a critical compatibility bug: the engine read the **monorepo root**
  package version (1.11.0) instead of its own (3.4.1) when checking plugin
  ranges. That silently failed every plugin validation, and the swallowed error
  dropped all extra Vite plugins — including Tailwind — so docs utility classes
  were never generated. Version resolution now walks up by package name, and the
  validation error is logged instead of swallowed.

  Enforce SPEC §2.3: `boltdocs audit` now runs as a preflight for both `build`
  and `dev`, and fails the command on unresolved plugins, scan errors, truncated
  scans or high-risk findings. Every shipped plugin declares `version` and
  `boltdocsVersion`, and the validator requires them. Plugin identity can name a
  different package via `packageName` (used by git-meta's two exports).

  The scanner now treats spawning/forking a fixed local process as a warning and
  reserves `high` for shell execution; Mermaid no longer auto-installs Chromium
  with `npx` behind the user's back. The metadata version check compares the
  engine version against the plugin's supported range instead of the plugin's own
  version. CI runs `boltdocs audit` after building.

- 94aebbc: The engine depends on nothing but the contracts.

  The package graph, measured from the manifests:

  ```text
  @bdocs/contracts   (no dependencies)
  @bdocs/primitives  (no dependencies)
  @bdocs/runtime     → @bdocs/contracts
  @bdocs/theme-neutral → @bdocs/contracts, @bdocs/primitives, @bdocs/runtime
  @bdocs/ssg         → @bdocs/contracts
  boltdocs (engine)  → @bdocs/contracts, @bdocs/processor-satteri, @bdocs/ssg
  ```

  **The `Boltdocs` global namespace moved to `@bdocs/contracts`.**

  It is augmented by the generated route types, and TypeScript rejects two
  `declare global` blocks for the same namespace, so it has exactly one home. It
  lived in `@bdocs/runtime`, which made the engine's re-export a type-only
  dependency on the browser half — one that compiles, ships nothing, and was
  therefore invisible in every install-size measurement.

  The contract layer cannot name React, so the MDX component map became a
  generic there, and `@bdocs/runtime` instantiates it with `ComponentType`. The
  shape a consumer sees is unchanged.

  **The engine declares no peer dependency at all.**

  It renders nothing. React, React DOM and the router are the browser half's
  business, and the browser half is a package the site installs. A site that
  installs a theme already installs React; a site that does not should not be
  made to.

  **The plugins read the contract types from the contracts.**

  `RouteMeta`, `SearchIndexParams` and `RouteContributor` now come from
  `@bdocs/contracts` rather than from the engine, so a plugin can be written
  against the contract layer alone. The engine-bound types — `PluginContext` and
  `BoltdocsPlugin`, which are the contracts' generics bound to the engine's
  config and to Node's request and response types — still come from the engine,
  because that binding is the value the plugin gets from it.

- Updated dependencies [1413a37]
- Updated dependencies [4fb6ed1]
- Updated dependencies [7628363]
- Updated dependencies [4a2de60]
- Updated dependencies [f7464bf]
- Updated dependencies
- Updated dependencies [4fb6ed1]
- Updated dependencies [223e891]
- Updated dependencies [4fb6ed1]
- Updated dependencies [d80c6e1]
- Updated dependencies [d1e7f76]
- Updated dependencies [cdd636a]
- Updated dependencies [7a26134]
- Updated dependencies [a19cc4a]
- Updated dependencies [be963fa]
- Updated dependencies
- Updated dependencies [3007d0b]
- Updated dependencies [9a4c13b]
- Updated dependencies
- Updated dependencies [fd11c2f]
- Updated dependencies [4fb6ed1]
- Updated dependencies [4fb6ed1]
- Updated dependencies [c2e2b6b]
- Updated dependencies [e6837b3]
- Updated dependencies
- Updated dependencies [4fb6ed1]
- Updated dependencies [40a4c01]
- Updated dependencies [80b8bba]
- Updated dependencies [94aebbc]
- Updated dependencies [40a4c01]
- Updated dependencies [53ba421]
- Updated dependencies [84e874d]
- Updated dependencies [cf79338]
- Updated dependencies [32d05b3]
- Updated dependencies [727f796]
- Updated dependencies [cc053a8]
- Updated dependencies [597897b]
- Updated dependencies [5f7a09c]
- Updated dependencies [ffb5e55]
  - @bdocs/contracts@0.2.0
  - boltdocs@4.0.0
