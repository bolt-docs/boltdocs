# `@bdocs/grammars`

Vendored TextMate grammars and Shiki themes for Boltdocs, published as plain data modules. No runtime dependency on Shiki itself.

> **The core does not use this package.** Since 4.0 the built-in highlighter is [`@bdocs/highlight`](../boltdocs-highlight), a Prism tokenizer with no WASM and no TextMate grammars. This package is kept for custom highlighter adapters that want the grammars without re-vendoring them.

## Install

```bash
pnpm add @bdocs/grammars
```

## Use

```ts
import { COMMON_LANGS, LAZY_LANG_IMPORTS, normalizeLanguage } from '@bdocs/grammars'
import { THEMES_BUILD, THEMES_SUPPORTED } from '@bdocs/grammars/themes'
```

| Subpath | Contents |
| --- | --- |
| `.` | Language registry, aliases and lazy loaders (39 languages) |
| `./themes` | 7 vendored themes (`github-light`, `github-dark`, `tokyo-night`, …) |
| `./grammars/*` | Individual frozen grammar modules |

All data is build-time only. Nothing from this package is shipped to the browser.
