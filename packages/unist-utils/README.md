# `@bdocs/unist-utils`

Strictly-typed AST utilities for `unist` (mdast / hast / MDX) used by
**Boltdocs** core, every official `@bdocs/*` plugin and the Sätteri MDX
processor. This package is the single source of truth for the AST
helpers that were previously scattered across
`packages/core/src/node/plugins/plugin-utils.ts` and
`packages/core/src/node/mdx/shiki-adapter.ts`.

## When to use it

- You are authoring a Boltdocs plugin and need to walk or mutate the
  MDAST/HAST tree (e.g. add new slot declarations, transform MDX
  attributes, or extract metadata).
- You want a single import path for type guards, visitors and AST
  builders that won't churn every release.
- You want compile-time safety on the tree shapes you read or build,
  without depending on `unist` or `unist-util-visit` directly.

## Public surface

| Group | Exports |
|-------|---------|
| Node-type constants | `MDX_NODES`, `MdxNodeType`, re-exports `SKIP`, `EXIT` from `unist-util-visit@5` |
| Generic unist types | `Node`, `Parent` |
| MDAST | `MdxJsxAttribute`, `MdxJsxAttributeValueExpression`, `MdxJsxElement`, `MdxJsxChild`, `CodeNode`, `PlainTextNode` |
| HAST | `ElementNode`, `HastNode`, `HastChild` |
| Helpers | `NodeWithHProperties` |
| Type guards | `isMdxJsxElement`, `isMdxJsxTextElement`, `isMdxJsxLike`, `isElementNode`, `isTextNode` |
| Visitors | `visitNodes`, `visitRehypeElements`, `visitMdxElements`, `visitRemarkHeadings`, `visitRemarkLinks` |
| Builders | `createMdxAttribute`, `createMdxElement`, `createRehypeElement` |
| Properties | `setNodeProperty`, `getNodeProperty` |
| Class list | `addNodeClass`, `removeNodeClass`, `hasNodeClass` |
| Meta parser | `parseMetaString`, `ParsedMeta` |

## Migration from `boltdocs`

```ts
// Before (still works as a back-compat shim):
import { visitNodes, createMdxAttribute } from 'boltdocs'

// After (preferred for new code):
import { visitNodes, createMdxAttribute } from '@bdocs/unist-utils'
```

Both paths are accepted today; the old one forwards to this package via
a thin shim so we can iterate on the public surface without breaking
existing plugins.

## Notes

- The package depends on `unist-util-visit@^5` but does **not** require
  the upstream `unist` types package — `Node` and `Parent` are
  inlined as structural copies so plugin authors get a 100%-typed surface
  even when the host environment lacks a direct dep on `unist`.
- Type guards are exported alongside their inferred types so plugin
  authors can use them as TS narrowing predicates.
- The `ParsedMeta.__raw` field is **set by callers**, not by
  `parseMetaString`. Boltdocs' `shiki-adapter` populates it before
  passing `meta` to the highlighter so the original string is
  recoverable.

See `AGENTS.md` in the repository root for project-wide conventions.

## License

Released under the [MIT License](https://opensource.org/licenses/MIT),
the same as the rest of the Boltdocs monorepo.
