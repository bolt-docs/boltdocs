# @bdocs/plugin-lightningcss

Transforms site stylesheets with Lightning CSS: minification, syntax lowering and modern CSS transpilation.

## Install

```bash
pnpm add @bdocs/plugin-lightningcss
```

## Use

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import lightningcssPlugin from '@bdocs/plugin-lightningcss'

export default defineConfig({
  plugins: [
    lightningcssPlugin({
  targets: { chrome: 100, firefox: 100 },
}),
  ],
})
```

## Docs

[Plugin guide](https://boltdocs.vercel.app/docs/plugins)
