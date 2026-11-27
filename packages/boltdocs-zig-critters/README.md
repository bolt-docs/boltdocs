# `@bdocs/zig-critters`

A critical-CSS extractor written in Zig and compiled to WebAssembly. It parses
the built stylesheet, matches it against each rendered HTML page, and returns
only the rules needed above the fold. Boltdocs inlines that result as a single
`<style data-zig-critters>` tag.

It is the default for `ssg.criticalCss: 'zig-critters'`. If the WASM binary is
unavailable, the SSG falls back to Beasties and the build still succeeds.

For the implementation details, see [How Boltdocs Uses Zig in Its Build-Critical Path](https://boltdocs.vercel.app/docs/blog/how-we-use-zig).

## Install

Installed transitively by Boltdocs. Direct use is possible with plain Node:

```bash
pnpm add @bdocs/zig-critters
```

```js
import { extractCriticalCss } from '@bdocs/zig-critters'

const { criticalCss } = await extractCriticalCss(html, css, { compress: true })
```

## API

| Export | Purpose |
| --- | --- |
| `extractCriticalCss(html, css, options?)` | Serial extraction through one process-global WASM instance |
| `createZigCrittersPool()` | Worker-thread pool, one WASM instance per worker |
| `getEngineIdentity()` | SHA-1 of the deployed `.wasm`, for cache keys |

The serial API shares linear memory, so calls are chained through a promise
queue. The SSG prefers the pool and only uses the serial path as a fallback.

### Why the engine identity matters

Critical CSS is embedded in cached pages. A cache keyed only by page and
stylesheet would serve output produced by an older binary forever. Mix
`getEngineIdentity()` into your cache identity: when the extractor changes,
every derived cache invalidates once, in the build that ships the new binary.

## How the WASM bridge works

Zig exposes four symbols: `getResultPtr`, `getResultLen`, `reset` and
`processCriticalCss`. The extractor writes its result into linear memory and
returns a pointer and a length; JS reads the bytes from `memory`.

The result has to survive until JS has read it, so the Zig arena is **reset at
the start of the next call**, not at the end of the current one. The ABI still
carries `arena_ptr` and `arena_size` for compatibility, but they are ignored:
large stylesheets grow the arena with linear memory instead of a fixed scratch
window.

## Working on it

The pinned toolchain is Zig **0.17.0**. The WASM binary is committed at
`zig/zig-out/bin/zig-critters.wasm` and shipped in the npm tarball; consumers do
not need Zig.

```bash
pnpm test        # Zig unit tests (selector, css, html)
pnpm test:js     # Node tests against the compiled WASM
pnpm build:wasm  # rebuild zig-critters.wasm
pnpm bench       # compare against Beasties
```

The native build (`pnpm build:native`) exists for benchmarking only.

## Limits

- Selector matching is a reimplementation of Beasties' behaviour, not a browser
  engine. Complex pseudo-class chains can produce different output.
- Pseudo-classes and pseudo-elements are stripped before matching, so `:hover`
  and viewport-dependent rules are matched against their base element.
- The Zig unit suite currently covers the selector, CSS and HTML modules; the
  top-level extraction logic is covered by the Node tests.
