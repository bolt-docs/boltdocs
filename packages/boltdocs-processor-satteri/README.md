# `@bdocs/processor-satteri`

The MDX compilation pipeline used by Boltdocs, built on the Sätteri processor. It owns the remark/rehype adapters, the compile worker pool, syntax highlighting hooks and the manifest-driven incremental cache.

> **Used by the engine.** `boltdocs` depends on this package and drives it during `dev` and `build`; a site does not configure it directly. This package has a peer dependency on `boltdocs` because a few code paths dynamically import `boltdocs/node/cache` and `boltdocs/node/highlight`. That is a deliberate peer cycle: installing `boltdocs` satisfies it, and the package is not meant to be used standalone.

## Install

```bash
pnpm add boltdocs
# or, for direct use:
pnpm add @bdocs/processor-satteri
```

## Use

```ts
import { createSatteriProcessorPlugin, CompilePool } from '@bdocs/processor-satteri/node'
```

| Subpath | Contents |
| --- | --- |
| `.` | Processor plugin factory and public types |
| `./node` | Compile pool, HAST/MDAST plugins and worker helpers |

The default highlighting engine is [`@bdocs/highlight`](../boltdocs-highlight). Custom highlighters are registered through the engine's highlighter SPI.
