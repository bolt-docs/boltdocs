# `@bdocs/ssg`

Static site generation for Boltdocs: the client and server Vite builds, HTML rendering, critical CSS and the content-addressed page cache. Used internally by the engine.

> **Installed as part of `boltdocs`.** You rarely configure this package directly — `boltdocs build` drives it. It is published separately so the engine can keep its own dependency graph small.

## Install

```bash
pnpm add boltdocs
# or, for direct use:
pnpm add @bdocs/ssg
```

## Use

```ts
import { build } from '@bdocs/ssg/node'

await build({ /* resolved Boltdocs config */ })
```

| Subpath | Contents |
| --- | --- |
| `.` | Client-side helpers |
| `./node` | Build pipeline and HTML rendering |
| `./single-page` | Single-page output helpers |
| `./style-collectors/styled-components` | Style collector integration |

Critical CSS uses [`@bdocs/zig-critters`](../boltdocs-zig-critters) when available; otherwise it falls back to `beasties` or disables inlining. Set `ssg.criticalCss` in the config to choose.
