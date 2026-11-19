# `@bdocs/parser`

The Markdown/MDX parser used by Boltdocs, written in Zig and exposed to Node through a WebAssembly build. Native N-API binaries are available for supported platforms, with WASM as the portable fallback.

## Install

```bash
pnpm add @bdocs/parser
```

Installed transitively by `boltdocs`. A `postinstall` step prepares or downloads the right binary for your platform.

## Use

```ts
import { runParser } from '@bdocs/parser'

const result = await runParser({ source: '# Hello\n\nSome **markdown**.' })
```

The parser produces headings and structural metadata consumed by the MDX pipeline — it does not render HTML.

## Building from source

Requires Zig 0.17.0:

```bash
pnpm build          # WASM + JS bundle
pnpm build:napi     # native shared library
pnpm test           # Zig tests
```
