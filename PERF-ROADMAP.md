# Performance Roadmap — Build & Render

Working notes for the build-pipeline performance effort on `develop`.
Measure everything on the real docs site (259 pages / 231 MDX) before and after.

## Baseline (measured, 8-core machine)

| Scenario | 62.1s era | develop @4da1cae1 | current develop |
| --- | --- | --- | --- |
| Incremental rebuild (30 content-edited pages) | 62.1s | 42.3s | **~66s (corrected — see below)** |
| Ultra-warm no-op build | 2.5s | 1.9s | **0.9–2.3s** |
| Full mtime rewrite (`touch` de 231 MDX + manifiesto + dists + lockfile) | 231.8s (observado una vez) | 231.8s | **0.9–2.3s — 259/259 cacheadas, client bypass** |

> Note on the incremental row: the earlier 27.5s figure came from a client
> build that silently lagged one build behind (see target #1 below). With
> correct invalidation, 30 MDX edits legitimately trigger a client rebuild
> (page text flows into route chunks + the search index), so ~66s is the
> honest measured cost of that scenario now.

Shipped so far (newest last):

```text
(this branch) perf(ssg): content-hash render cache, persistent critical-CSS cache, fully content-based client hash
4da1cae1 perf(ssg): parallel SSR prewarm, higher finalize/render concurrency, CLI compile cache
eed56139 fix(satteri): revive MDX precompile cache (docsDir + stable signatures)
44859c9a perf(highlighting): single grammar pass, per-worker cache, JS engine default
```

## What landed on top of 4da1cae1 (all measured, not speculative)

### 1. Render cache keyed by real content hash ✅ (was: mtimeMs:size)

`getSsgSourceContentHash` / `hashSourceFileContentSync` return a **sha1 of the
source file bytes** (prefixed by a `v2\0` format version so legacy `mtime:size`
entries can never false-positive; they miss once and get rewritten). Measured:

- Pure mtime rewrite of all MDX + manifest → **259/259 cached**.
- Full checkout simulation (MDX + src + public + both framework dists +
  lockfile + config touched) → **259/259 cached, client build bypassed,
  0.9–2.3s total**.

Routes without a source file (synthetic base routes) use the client-bundle
identity as fallback — correct invalidation for those.

### 2. Critical CSS persisted to disk ✅ (structural keys, TTL + cap prune)

`CriticalCssCache` gained an optional `cacheDir` (`<cacheDir>/critical-css/`):
payloads keyed by `(engine, structural HTML, stylesheet hash)` — identical key
to the in-memory map. Text-only edits keep the page structure, so the ~1s WASM
extraction is reused across builds (measured `criticalCssP50` 151ms→41ms on the
incremental run after the first persisted one). Turbo mode skips the layer.
`pruneCriticalCssDiskCache` garbage-collects by 30-day TTL and 5000-entry cap
(LRU via atime touch on hit), runs at most once per minute alongside the page
prune. Null results (nothing to inline) are cached too, and corrupted files just
re-extract.

### 3. Client hash is fully content-based ✅ (v4 — supersedes the manifest proxy)

The client hash hashes **content only**, from three sections, all
sorted-walk `relativePath\0sha1(bytes)` pairs:

- `boltdocs` + `@bdocs/ssg` dist dirs (framework code — workspace symlinks are
  followed, so a core rebuild invalidates the site's client cache).
- Everything under `docs/` (MDX content, public assets, src overrides) read
  **directly from the source bytes**.
- Config content (`boltdocs.config.*`, `package.json`, `tsconfig.json`).
  Lockfiles are excluded — their bytes never enter the bundle and their mtimes
  churn on checkout.

The intermediate design (v3) hashed a canonical projection of the Sätteri
manifest (`globalKey` + sorted `contentHash\0exportName\0outFile`). That fixed
stat noise but introduced a **one-build lag**: the manifest is only rewritten
during the client build, so editing 30 pages changed the hash one build late —
the client bundle built in run N described run N−1's content (stale search
index / route chunks for one build), and reverting the edit forced a spurious
18s rebuild the next run. Both directions measured. Hashing the docs bytes
directly (~5MB, tens of ms, twice per build) removes the artifact proxy
entirely: the same edit is picked up by the build that observes it, and there
is no cross-run oscillation.

Also fixed: the previous stat-only framework pass only matched extensions like
`.js`, silently ignoring the `.mjs`/`.cjs` chunks tsdown emits — a core rebuild
could go unnoticed. The content walk hashes every file.

### 4. Precompile pool warm-up ✅ (already in 4da1cae1, verified)

`compile-worker.ts` eagerly compiles a synthetic MDX doc with fences in the 10
eager languages at worker spawn, so grammar + WASM init happens during pool
spin-up. Verified live: `precompile: 201 hit / 30 miss` and `231 hit / 0 miss`
on warm runs. Nothing left to do here.

### 6. Ultra-warm fast path restored; deployment mirror made add-only ✅ (measured)

Two bugs were compounding:

- The docs site's post-build script (`scripts/prepare-deployment-dist.mjs`)
  mirrors root-level dist entries under `/docs/` with **rmSync + copy**. A
  stale root-level `es/` leftover (3 pre-base-era pages) therefore deleted the
  128 freshly built `/docs/es/**` pages after every build and copied the fossil
  over them — 125 locale pages missing from every deployment, silently. The
  script is now **add-only** (`if (exists(destination)) continue`), and it
  registers everything it mirrors as `extraFiles` in the SSG output state.
- The ultra-warm fast path demanded `auxiliaryFiles.length === 0`, but SEO
  (`sitemap.xml`, `robots.txt`) and llms/RSS plugin output are always written
  after the state — so the lean path (reuse dist as-is, no reset/restore)
  could never activate on a real site. Aux output that provably derives from
  routes + config (both already covered by the client-hash gate) is now
  accepted when every file still exists; anything else forces the normal
  pipeline, which regenerates it.

New `extraFiles` field in `SsgOutputState`: root-relative files present in
the output but produced by post-build tooling instead of the pipeline. The
reuse check requires every registered extra to still exist and no unregistered
file to appear; unknown extras cost one reset pass, then the tooling
re-registers them — self-healing by construction. `readSsgOutputState` was
dropping the new field on load (silent zero), which the inode test caught.

**Measured (docs site):** no-op build back to **~0.5s with the dist inode
untouched** (the reset-and-restore pass no longer runs); all 259 pages
validate; `/docs/es` keeps its 128 pages; the mirror script converges (308
extra files registered, stable across runs).

### 5. `onPageRenderedHookMs` metric corrected ✅ (was summing overlapping deltas)

The roadmap's 4.7s "hooks re-scan rendered HTML" hypothesis was **wrong** — the
llms-text/RSS plugins generate from route meta and only do two `'</head>'`
replaces per page, and the public-asset resolver memoizes. A microbenchmark of
the full hook-equivalent over real dist HTML costs ~4.1ms/page (~0.95s over 231
pages). The inflated 4.7s came from summing per-page `performance.now()` deltas
while renders run in parallel; the metric now tracks an open/close interval
union and reports the wall time the hook pipeline actually occupied. (The
per-page rewrite cost itself is still real work — see next targets.)

## Next targets, in priority order

### 1. Incremental client rebuild granularity — DONE (measured)

What the investigation found (all measured on the docs site):

- The client entry raced the SSR build for a shared resolved-config global.
  When SSR resolved last, the CLIENT entry took the SSR branch: `combined.mjs`
  (all page bodies) inlined into `app-*.js` and **no `search.json` emitted**.
  Fixed per-call via `this.environment.config.consumer` (rolldown's `load`
  hook does not pass `options.ssr`, so the hook-arg route is not viable).
- `_rawContent` (full MDX text, 243 pages) traveled inside
  `virtual:boltdocs-routes` → embedded in `app-*.js`. Moved to a lazy
  `page-source.json` asset (CopyMarkdown fetches at copy time, session-cached).
  `app-*.js` went 2.3MB → ~1.2MB and no longer references `combined`.
- Client now loads real Sätteri chunk packs (chunk-0..4, lazy per navigation).
- Per-route identity = pack hash ⊕ SSR-bundle guard (entry/layouts/theme,
  excluding `.vite/` manifests and the page-body chunk; the entry's embedded
  `combined-<hash>.js` specifier is normalized) ⊕ stylesheet guard. Text edits
  move none of these; layout/CSS edits move the guards — re-render everything,
  correctly.
- Cache hits that survive a client rebuild rewrite the stale `app-*.js` URL
  embedded in cached HTML (onCacheHit), instead of re-rendering.

**Measured (docs site, 259 pages):** 1-page text edit → **78 new / 181 cached**
(was 259/0) in ~21s wall (was ~32s); no-op → fast path 0.5s; revert → same 78
re-render from cache, no oscillation; browser check: layout + lazy
`page-source.json`/`search.json` OK, critters intact.

Remaining granularity headroom (not scheduled): the 28 synthetic routes ride
the fallback identity and re-render on any client rebuild — they have no page
body, so they could key on the guards alone. Sätteri now chunks at 15
pages/pack for sites this size (see target 2), bounding best-case incremental
renders at pages-in-the-edited-pack + 28.

### 2. Public-asset rewrite cost on full re-renders — DONE (measured)

- The two passes (`src|href|poster|content` + `srcset`) fused into ONE
  pre-compiled scan; module-level regexes replace per-call `new RegExp`.
  Output is byte-identical with the old behavior — including the accidental
  legacy handling of `data-srcset="…"` as a srcset list, now pinned by a test.
- `createPublicAssetResolver` now exposes `mightRewrite(html)`: a
  case-insensitive pre-scan gate built from the public dir's actual top-level
  entries (percent-encoded variants included). Pages that cannot reference a
  public asset skip the scan entirely. Hand-built resolvers without the gate
  just always run the scan.
- The gate is deliberately unanchored — any occurrence of a public first
  segment as a path segment trips it. Anchoring on the attribute name would
  miss srcset lists whose public candidate is not the first entry: a
  correctness bug the new unit tests caught before it shipped. False
  positives only cost the normal scan.

**Measured (docs site, 142 collected rendered HTML pages, best-of-5):**
817µs → 757µs per page (~7% faster). The roadmap's original premise
("~0 public-asset refs per page") no longer holds — blog cover images are
embedded root-absolute on most pages, so the gate rarely skips and the fused
scan carries the win. Matters only on builds that re-render many pages,
exactly when it matters.

Also fixed along the way: `FeaturedResources` on the docs site called
`window.matchMedia` at render time, which crashes SSR (and would hydrate a
different post count than the server rendered). The mobile behavior it wanted
(first card only below md) is expressed in CSS, SSR-safe.

### 3. Full cold build

Client + server builds run in parallel already. Remaining win: profile Vite
itself (rolldown flags, chunking) — out of scope.

## Known traps (do not relearn these)

- **Guard surfaces must exclude page-text artifacts**: `.vite/` manifests embed
  hashed chunk names that rename on every text edit, and the SSR entry embeds
  the page-body chunk's `combined-<hash>.js` specifier — hash the entry with
  that specifier normalized, or text edits re-invalidate everything.
- **Fast path validates against the fallback identity**: the ultra-warm path
  checks synthetic routes against `pageContentFallbackHash` computed BEFORE
  Vite resolves. Any identity mixed only after the bundle phase desyncs the
  fast path from what the previous build stored (12s regression, silent). If
  the client build is bypassed, compute the guards from the cached dirs early.
- **Every new root-level dist file must join `pageFiles`** in the ssg-output
  state (fast path uses it for reuse) or the fast path silently disables.
- `docsDir` reaching Sätteri is ABSOLUTE — always `path.resolve(root, docsDir)`, never `path.join`.
- Plugin signatures must not bake per-process nonces (`pid/Date.now/Math.random`) into the precompile cache key — kills all cache hits.
- `<!-- -->` comments are invalid in MDX; use `{/* */}`.
- The precompile log line only prints on the slow path (misses); fast path returns silently.
- Ultra-warm builds take the pre-SSG fast path: no precompile logs, no manifest rewrite.
- **Cache-key formats are opaque everywhere**: `contentHash` strings are only
  ever compared for equality, so changing the derivation needs a version prefix
  (`CONTENT_HASH_VERSION` in `cache-validation.ts`, `CLIENT_HASH_VERSION` in
  `client-hash.ts`) — otherwise old entries false-positive. The prefixes are
  what lets legacy entries miss *safely*.
- **Never put a build-order artifact in the client hash**: the Sätteri
  manifest only updates during the client build, so any input derived from it
  lags one build behind content edits (edit in N → hash change in N+1 →
  spurious rebuild; revert in N+1 → rebuild again in N+2). Hash the source
  bytes directly instead.
- **Summing per-page deltas under parallelism double-counts**: concurrent
  renders overlap, so `+= now()-start` inflates phase metrics. Use an
  open/close interval union (see `onPageRenderedHookMs` in `build.ts`).
- **Stat-only extension filters rot**: the framework hash used to match `.js`
  only while tsdown emits `.mjs`/`.cjs` — a rebuilt core looked unchanged.
  Content-walk everything you mean to hash.
- **`Object.fromEntries` drops extra array elements** — `[file, a, b, c]` pairs
  silently become `{file: a}`. That's how the first manifest-projection draft
  lost `exportName`/`outFile` (caught by the unit test, not by review).
- **Rebuild workspace dists before benchmarking**: the docs site consumes
  `packages/*/dist`, not `src`. A stale dist measures old code silently — and
  a rebuilt dist legitimately invalidates the client cache once (that's the
  content hash working).
- **A full `git checkout` of the docs tree during a benchmark round mimics a
  content edit**: 333 files got their mtimes rewritten mid-round and one run
  rebuilt "for no reason". Verify `git status docs/docs` is clean and which
  files actually changed bytes (content, not just mtime) before attributing a
  rebuild to a bug.
- **Post-build tools that mutate dist must own their footprint in the output
  state** (`extraFiles`) — anything unregistered silently disables the fast
  path, and anything written blind (a mirror over freshly built pages) can
  destroy output. Mirror/copy scripts must be add-only.
- **State readers must round-trip every field**: `readSsgOutputState`
  rebuilt the state via the factory and dropped `extraFiles` — the check
  then saw extras=0 while the file said 308, and only an inode-stability test
  exposed it. When adding a state field, add it to the reader explicitly.
- **A package rebuild during benchmarking changes the client hash** (the
  docs site hashes workspace dists) — the next build legitimately resets
  dist. One transition build after any framework rebuild; only the run
  after that proves fast-path behavior.
- **The client hash now covers the site's `src/`** (theme overrides) in
  addition to framework dists and `docs/`. Before, a theme-only edit skipped
  the client build AND left every cached page stale with the old layout —
  this silently masked the OnThisPage fixes below during verification. The
  hash change makes the next build a full transition (259 re-renders); plan
  for it.

## Round 4 — OnThisPage invisible (two root causes, both client-side)

Symptom: the OnThisPage rail (and any element revealed by a utility the
landing page never used) disappeared for the whole SPA session. Two
independent bugs, found by reproducing in headless Chrome and enumerating the
cascade:

1. **Stale critters inline styles.** Every pre-rendered page inlines a
   `<style data-zig-critters>` with the utilities that page uses. The block of
   the *first* visited page survives client-side navigation and, emitted after
   the external stylesheet, wins the cascade — its `.hidden{display:none}`
   permanently beat `xl:flex` on every page reached via SPA. Fix: the shell
   removes `style[data-zig-critters]` blocks on mount (the external stylesheet
   is always in the initial HTML, so removal cannot flash).
2. **Collection posts never resolved `currentRoute`.** Post route records are
   registered without the docs base (`blog/post`, sometimes no leading slash)
   while the URL carries both (`/docs/blog/post`), so `useRoutes()` missed,
   `headings` arrived empty and the theme wrapper returned null (this is also
   why the navbar behaved oddly on blog pages). Fix: longest segment-tail
   fallback restricted to collection routes.

Also discovered: the docs blog uses a custom post component
(`docs/docs/[blog]/post.tsx`) that renders its own in-article TOC — the
layout's right rail is now gated off for collection pages to avoid duplicate
TOCs (convention: pick ONE). Verified in browser: exactly 1 visible OTP in
direct + SPA navigation for docs pages, blog posts and es pages.

Cost: none of this is on the hot build path (one effect on hydration, one
memoized lookup, one extra directory in the pre-build hash walk).

## How to re-run the benchmark

```bash
# 0. Rebuild the packages the docs site actually consumes
pnpm --filter @bdocs/ssg build && pnpm --filter boltdocs build

# 1. Warm state
cd docs && pnpm build   # run twice; second run should be <5s wall

# 2. Timed incremental (30 edits with code fences)
cd /path/to/repo && grep -rlF '```' docs/docs --include='*.mdx' | sort | head -30 > /tmp/bench-files.txt
while read -r f; do printf '\nbench-marker: perf-run\n' >> "$f"; done < /tmp/bench-files.txt
cd docs && BOLTDOCS_BENCHMARK_PHASES=true pnpm build > /tmp/bench.log 2>&1
grep -E 'precompile:|Render pages' /tmp/bench.log | tail -3

# 3. Full checkout simulation (the old 231.8s scenario; expect 0 new pages + client bypass)
find docs/docs docs/src docs/public -type f -exec touch {} +
find packages/core/dist packages/plugin-ssg/dist -type f -exec touch {} +
touch docs/pnpm-lock.yaml docs/package.json
cd docs && BOLTDOCS_BENCHMARK_PHASES=true pnpm build > /tmp/bench-touch.log 2>&1
grep -oE '"details":"259 pages[^"]*"' /tmp/bench-touch.log   # expect "0 new / 259 cached"

# 4. Cleanup
git checkout -- docs/docs
```
