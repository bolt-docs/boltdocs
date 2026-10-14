---
'@bdocs/contracts': minor
'@bdocs/processor-satteri': minor
'boltdocs': major
---

Make the highlighter pipeline genuinely engine-agnostic.

The registry already accepted any adapter — `theme.codeHighlighting.engine` takes a string id, an adapter instance or a factory, and `registerPluginHighlighter` lets a plugin add one. That part was true. The *render pipeline* was not: two of its paths assumed the engine was Shiki, and Shiki was the only engine registered, so nothing ever exercised them.

Both are now covered by tests that use a fake engine, because a test against Shiki proves nothing about agnosticism — Shiki satisfies every accidental requirement the pipeline happens to have.

## `lang: 'plaintext'` was a Shiki convention sent to arbitrary engines

When a grammar failed to load, the pipeline degraded the block by re-rendering it with `lang: 'plaintext'`. That id is Shiki's: its name for a grammar with no rules. An engine that has never heard of it throws — so the code written to rescue a broken code block failed the same way the block did.

```ts
// before — reached for a language id the contract never defined
const plainHast = highlighter.codeToHast(codeText, { ...options, lang: 'plaintext' })
```

`CodeHighlighterAdapter` now carries the capability instead:

```ts
interface CodeHighlighterAdapter {
  renderPlaintext?(code: string, options: Record<string, unknown>): Promise<string>
}
```

Optional, so an adapter never has to implement it. The framework falls back to an escaped `<pre>` when it is absent — already correct, and better than asking a third-party engine to speak a dialect it was never taught.

## `shiki-fallback` named the default engine in the markup

The last-resort class was `shiki-fallback`, and `reset.css` keyed 28 rules off `.shiki`. Every non-Shiki engine was a guest in Shiki's stylesheet.

State is now expressed as data:

```html
<pre data-code-state="highlighted" data-code-engine="shiki" …>
<pre data-code-state="plaintext"   data-code-engine="…" …>
<pre data-code-state="fallback"    data-code-engine="…" …>
```

`.shiki-fallback` is kept as a CSS alias, alongside the aliases this file already carried for `data-theme-mode`, `data-line-numbers` and `data-word-wrap`. A theme styles the attribute and never needs to know which engine ran.

## `CodeTheme` is open

```ts
export type CodeTheme =
  | string
  | { light: string; dark: string }
  | { tokens: Record<string, string> }
  | Record<string, unknown>
```

An engine with semantic tokens or a CSS custom-property palette cannot be expressed by a name or a light/dark pair. Narrowing the union to enumerate engines would make every future engine a breaking change to the framework, which is backwards.

## What the tests found

Writing the CSS assertion first surfaced a fourth leak that was not in the plan: `pre span.shiki-line-highlight` was the one rule in `reset.css` with no neutral counterpart. It now pairs with `[data-line-highlight]`, and `tests/node/highlight-styles.test.ts` fails on any future `.shiki` selector that has no neutral form — which is exactly the regression that would quietly make the stylesheet Shiki-only again.

**Verified:** 1002 core tests, 36 contract tests, 120 Sätteri tests, 257 documentation pages with byte-identical highlighting and `data-code-state="highlighted"` present in the output.
