# `@bdocs/zig-critters`

Critical CSS extraction engine written in Zig and compiled to WebAssembly. It reads a rendered page and its stylesheet and returns only the CSS used above the fold.

> **Optional dependency of `@bdocs/ssg`.** SSG works without it: when the WASM binary is unavailable, critical CSS inlining is disabled (or switches to `beasties` if configured). Install it for the fast path.

## Install

```bash
pnpm add @bdocs/zig-critters
```

## Use

```ts
import { extractCriticalCss, getEngineIdentity } from '@bdocs/zig-critters'

const css = await extractCriticalCss(html, stylesheet)
```

`getEngineIdentity()` is a SHA-1 of the deployed WASM binary. Consumers mix it into their cache keys so a new binary invalidates derived caches exactly once.

## Building from source

Requires Zig 0.17.0:

```bash
pnpm build:wasm   # produces zig/zig-out/bin/zig-critters.wasm
pnpm test         # Zig tests
pnpm test:js      # JS wrapper tests
```

The published tarball includes the compiled WASM binary, so no build toolchain is needed at install time.
