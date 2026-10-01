# Integration independence audit

Measurement taken on `4.0` at `2768b75b`, removing every optional integration
from the documentation project and from `packages/core` to see what the "4.0
definition of done" requires:

> optional integrations can be removed without breaking the core

## What was removed

From the project configuration: `@bdocs/plugin-mermaid`, `@bdocs/plugin-math`,
`@bdocs/plugin-llms-text`, `@bdocs/plugin-rss`, `@bdocs/plugin-ask-ai`.

From `packages/core` dependencies: `@bdocs/plugin-image-optimizer`.

## Result

**The build succeeds.** 238 pages in 60.2s, every pipeline step green
(`Config resolve`, `Route generate`, `SEO validate`, `Type generate`,
`SSG build`, `Redirects write`, `SEO write`). It emits 25 fewer pages than the
full build (238 against 263), which is the output of the removed plugins.

So the criterion is met at the level that matters: a project that does not want
Mermaid, Math, Ask AI, Search, RSS or image optimization builds without them.

## What the measurement did not reveal

The output size did not change: 67,920 KB of `dist` either way, and the
JavaScript the browser downloads for a documentation page is unchanged. That is
the honest result, and it is the opposite of what was assumed going in.

## The real finding is elsewhere

Installed weight of the optional integrations:

| Package | Installed |
| --- | --- |
| mermaid | 75 MB |
| katex | 4.3 MB |
| flexsearch | 2.8 MB |
| svgo | 1.9 MB |
| sharp | 620 KB |
| isomorphic-dompurify | 56 KB |

**Mermaid alone is 75 MB installed, and it is a peer dependency pulled in by
default.** That is an installation cost, not a bundle cost, and it is the number
that should drive the package split.

In the browser the situation is already good, and it is worth recording why:

- KaTeX and Mermaid each get their own chunk (`katex-*.js` is 252 KB) and are
  only fetched by a page that uses that syntax.
- KaTeX's library is used at build time only. `source-transform.ts` calls
  `katex.renderToString` in Node, so no KaTeX JavaScript is ever sent to a
  browser.
- `flexsearch` is loaded dynamically and only when search is used.
- The `app` chunk does contain the Mermaid and Math React *components*, because
  the plugin registers them, but the libraries behind them are not in the chunk.

## What is genuinely wrong

`packages/core/src/node/plugin/index.ts` imports `ViteImageOptimizer` directly
and injects it unconditionally:

```ts
import { ViteImageOptimizer } from '@bdocs/plugin-image-optimizer'
...
...adaptVitePlugins([ViteImageOptimizer({ includePublic: true })]),
```

That makes image optimization mandatory for every project. `sharp` and `svgo`
are declared as `peerDependencies` of the plugin, so they are resolved and
installed whether or not the project asked for image processing. This is the one
place where an optional integration is hard-wired into the core.

## Conclusion

1. The stated criterion is satisfiable today, and the core already tolerates the
   absence of every optional integration. Slices 3 to 5 are therefore closer to
   reorganizing files than the roadmap implies.
2. The measurable win is not bundle size. It is install weight: 75 MB for
   Mermaid. Splitting the package graph so integrations are genuinely optional
   pays off there.
3. `ViteImageOptimizer` should become opt-in, the way every other integration
   already is. That is a small, contained change and it is the only hard
   coupling the audit found.
