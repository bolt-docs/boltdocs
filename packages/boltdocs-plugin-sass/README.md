# @bdocs/plugin-sass

Compiles `.scss` and `.sass` stylesheets in a Boltdocs site.

## Install

```bash
pnpm add @bdocs/plugin-sass
```

## Use

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import sassPlugin from '@bdocs/plugin-sass'

export default defineConfig({
  plugins: [
    sassPlugin(),
  ],
})
```

## Docs

[Plugin guide](https://boltdocs.vercel.app/docs/plugins/css/sass)
