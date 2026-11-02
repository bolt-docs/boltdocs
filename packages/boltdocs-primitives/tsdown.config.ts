import { defineConfig, licenseBanner, packageConfig } from 'tsdown-config'

export default defineConfig(
  packageConfig({
    entry: {
      index: 'src/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    // The JSDoc in this package explains *why* a decision was made. That belongs
    // in `dist/index.d.mts` and in the source, where a reader and an editor find
    // it. Shipping it a third time inside `index.mjs` cost ~10 kB of install for
    // text no bundler reads and no runtime uses.
    //
    // Only `jsdoc` goes; `legal` stays, because this is a published MIT package
    // and `comments: false` would silently strip a licence header the day
    // someone adds one.
    outputOptions: { comments: { jsdoc: false } },
    // Minified, which is worth 34.7 kB -> 19.6 kB. This does not make anyone's
    // page load faster — a consumer re-bundles this file and strips comments
    // anyway, so the win is entirely on disk in `node_modules`. The cost is that
    // the shipped artifact is no longer readable as a reference.
    //
    // Three things make that trade acceptable here. Consumers import
    // `@bdocs/primitives` through a bundler, so the source map in the `.d.mts`
    // and the published repository are where a reader goes. Every component sets
    // an explicit `displayName`, which survives minification, so React DevTools
    // still shows `Menu` rather than a mangled letter. And nothing in this
    // package branches on a function's `.name` — checked, the only `typeof x ===
    // 'function'` tests are on prop values, which minification does not touch.
    minify: true,
    banner: { js: licenseBanner },
    tsconfig: './tsconfig.json',
    deps: {
      neverBundle: ['react', 'react-dom'],
    },
  }),
)
