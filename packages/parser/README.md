# `@bdocs/parser`

The Markdown/MDX parser used by Boltdocs, written in Zig and compiled to native
binaries and WebAssembly. It is installed transitively by `boltdocs`; you do not
need to add it to a site yourself unless you call its API directly.

For the story behind it, see [How Boltdocs Uses Zig in Its Build-Critical Path](https://boltdocs.vercel.app/docs/blog/how-we-use-zig).

## What it returns

For every `.md`/`.mdx` file in a docs tree the parser produces one `ParsedDoc`:

```ts
interface ParsedDoc {
  rawMatter: string
  content: string
  headings: { level: number; text: string; id: string }[]
  plainText: string
  description: string
  frontmatter?: Record<string, unknown>
}
```

Frontmatter, heading slugs and the description are all parsed in Zig. The result
is JSON on the Node side, so nothing about the parser leaks into a theme.

## Three backends, one source

`runParser(docsDir, turbo?)` picks the fastest available backend and falls
through silently:

| Priority | Backend | Mechanism |
| --- | --- | --- |
| 1 | N-API shared library | Direct FFI through `koffi` (no `fork`/`exec`) |
| 2 | Native executable | Spawned binary, JSON on stdout |
| 3 | WASM + WASI | `node:wasi` preview1, module shipped in `dist/` |

If all three fail, the core falls back to its JavaScript parser. The build
degrades in speed, never in capability.

```ts
import { runParser, runParserFiles } from '@bdocs/parser'

const all = await runParser('docs', true) // `--turbo`: single-pass parse
const changed = await runParserFiles('docs', ['docs/index.mdx'])
```

`runParserFiles` is the incremental path used during dev: it reads only the
requested files through N-API.

### Debugging switches

| Variable | Effect |
| --- | --- |
| `FORCE_WASM=true` | Skip both native backends, use the embedded WASM module |
| `FORCE_EXEC=true` | Skip the N-API library, use the native executable |

## Platform support

`scripts/build-all.mjs` and the `build-parser.yml` workflow compile five native
targets plus `wasm32-wasi`:

| Target | Binary |
| --- | --- |
| `x86_64-linux-gnu` | `parser-linux-x64` |
| `aarch64-linux-gnu` | `parser-linux-arm64` |
| `x86_64-macos-none` | `parser-darwin-x64` |
| `aarch64-macos-none` | `parser-darwin-arm64` |
| `x86_64-windows-gnu` | `parser-win-x64.exe` |

`postinstall` downloads the right binary from the matching GitHub Release into
`.cache/@bdocs/parser/<version>/`. When the download fails — offline install,
new platform, blocked network — the WASM module in `dist/` takes over.

## Working on it

Zig **0.16.0** is the pinned toolchain. Zig is only needed to work on the parser;
consumers never install it.

```bash
pnpm test                 # Zig unit tests
pnpm build:native         # native executable
pnpm build:napi           # N-API shared library
pnpm build:wasm           # wasm32-wasi module
pnpm build:all-platforms  # all five native targets + WASM
pnpm test:ts              # Node/N-API integration tests
```

`pnpm build` compiles the TypeScript wrapper and copies `bdocs-parser.wasm` into
`dist/`. The copy is strict in CI and in `prepack`, so a published tarball can
never omit the portable fallback.

## Limits

- The WASM path is the slowest; the N-API library is the fastest. The difference
  only matters on large docs trees.
- Selected-file parsing requires the N-API backend; other backends parse the
  whole tree and filter the result.
- The WASI preview1 interface is deprecated in newer Node versions, but it is
  still available and is the compatibility path, not the default one.
