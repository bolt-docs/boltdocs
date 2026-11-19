# @bdocs/plugin-llms-text

Generates `llms.txt` and `llms-full.txt` indexes so AI agents can discover and consume your documentation.

## Install

```bash
pnpm add @bdocs/plugin-llms-text
```

## Use

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import llmsTextPlugin from '@bdocs/plugin-llms-text'

export default defineConfig({
  plugins: [
    llmsTextPlugin(),
  ],
})
```

## Docs

[Plugin guide](https://boltdocs.vercel.app/docs/plugins/content/plugin-llms-text)
