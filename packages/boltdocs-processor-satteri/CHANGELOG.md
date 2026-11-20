# @bdocs/processor-satteri

## 1.0.0

### Minor Changes

- Make the highlighter pipeline genuinely engine-agnostic.
- Replace the built-in Shiki highlighter with `@bdocs/highlight`, a Prism-based, dependency-free (no Oniguruma/WASM) syntax highlighter.
- Vite 8.3.5, and only Vite 8.3.
- A user plugin's MDX hook can be rebuilt in a build worker, so a site with one keeps its parallel MDX compile.

### Patch Changes

- Every package type checks.
- A code block keeps its own fence title, whichever page was compiled first.
- Add a real Sätteri fidelity test covering the four constructs named in SPEC §2.4: fenced code blocks, inline HTML, GFM tables and custom components.
- The engine depends on nothing but the contracts.
- Three performance changes, and a grammar that was missing.
- The type checker is clean, and the highlighting configuration has one type.

## 0.4.0

### Minor Changes

- Boltdocs 3.4.0 — architecture contracts and incremental build foundation.

### Patch Changes

- Stop shipping every highlighted code block twice to the browser.
- Drop whitespace-only text nodes inside table sections during MDX compilation The compiler preserved the newlines that separate table rows and cells and emitted them as text children of `<tbody>` and `<tr>`.

## 0.3.4

### Patch Changes

- Align internal Vite development and build tooling on Vite 8.1, make the Boltdocs versus Docusaurus Faster benchmark cold-cache aware, and preserve route-level SSG render identity when a client build cannot emit a route-specific chunk.

## 0.3.3

### Patch Changes

- Finer Sätteri chunk packs and a single-scan public-asset URL rewrite pages (was 50), 20 for 50–200 (was 30).

## 0.3.2

### Patch Changes

- Make code syntax highlighting engine-agnostic: the core now renders via a `CodeHighlighterAdapter` resolved from a registry instead of calling Shiki directly.
- Fix two silent bugs that disabled the MDX precompile cache on every build Measured on the 259-page docs site: warm builds now report `precompile: 231 hit / 0 miss / 1.5s` instead of recompiling the full site invisibly on every build.

## 0.3.1

### Patch Changes

- Fix two silent bugs that disabled the MDX precompile cache on every build Measured on the 259-page docs site: warm builds now report `precompile: 231 hit / 0 miss / 1.5s` instead of recompiling the full site invisibly on every build.

## 0.3.0

### Minor Changes

- Precompile MDX early from `configResolved()`, size the worker pool dynamically based on CPU count and file count, and fix remaining JSX transpilation in compiler workers with stale cache invalidation.

### Patch Changes

- Declare `esbuild` as a runtime dependency so published processor builds can resolve it in pnpm-isolated consumer projects.
- Fix a dev-server race where a `server.restart()` could dispose the shared route-cache context while the new server's virtual modules still held a reference to it, surfacing as "Route cache context has been disposed" errors on reload.

## 0.2.0

### Minor Changes

- Phase 1 of the new plugin API.
