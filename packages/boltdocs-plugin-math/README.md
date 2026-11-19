# @bdocs/plugin-math

Renders LaTeX math in MDX with KaTeX. Formulas are compiled at build time; only a tiny runtime is sent to the browser.

## Install

```bash
pnpm add @bdocs/plugin-math
```

## Use

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import mathPlugin from '@bdocs/plugin-math'

export default defineConfig({
  plugins: [
    mathPlugin(),
  ],
})
```

Import `@bdocs/plugin-math/style.css` in your stylesheet.

## Docs

[Plugin guide](https://boltdocs.vercel.app/docs/plugins/content/plugin-math)
