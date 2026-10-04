import { defineConfig, licenseBanner, packageConfig } from 'tsdown-config'

export default defineConfig(
  packageConfig({
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    // The JSDoc in this package explains *why* a decision was made. That
    // belongs in `dist/index.d.mts` and in the source, which is where a reader
    // and an editor will find it. Shipping it a third time inside `index.mjs`
    // cost ~10 kB of install for text no bundler reads and no runtime uses.
    //
    // Only `jsdoc` is dropped. `legal` stays on: this is a published MIT
    // package, and `comments: false` would silently strip a licence header the
    // day someone adds one.
    outputOptions: { comments: { jsdoc: false } },
    banner: { js: licenseBanner },
    tsconfig: './tsconfig.json',
    deps: {
      neverBundle: ['react', 'react-dom'],
    },
  }),
)
