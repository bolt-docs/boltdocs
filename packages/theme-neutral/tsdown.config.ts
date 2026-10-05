import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, licenseBanner, packageConfig } from 'tsdown-config'

export default defineConfig(
  packageConfig({
    // Two entries, and the split between them is load-bearing.
    //
    // `index` is the ui-base surface. `components/primitives` is the
    // layout-level primitives, and it holds the search dialog behind a dynamic
    // import on purpose — a reader who never opens search never downloads it.
    //
    // When the primitives barrel was also reachable from `index`, tsdown hoisted
    // that dynamic import into a static one and the 112 kB search chunk became
    // part of the first visit: 853.7 kB of eager JS became 965 kB. Two entries
    // with no overlap in what they export is what keeps the boundary where the
    // source put it.
    entry: {
      index: 'src/index.ts',
      'components-primitives': 'src/components/primitives/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    // Same three reasons as `@bdocs/primitives` and `@bdocs/runtime`: the JSDoc
    // belongs in the source and the `.d.mts`; `legal` stays because this is a
    // published MIT package; and minifying is a disk win rather than a page-speed
    // one, since consumers re-bundle this file anyway.
    outputOptions: { comments: { jsdoc: false } },
    minify: true,
    banner: { js: licenseBanner },
    tsconfig: './tsconfig.json',
    deps: {
      neverBundle: ['react', 'react-dom'],
    },
    async onSuccess() {
      // The stylesheet ships with the theme rather than from the core. A second
      // theme is a second package with its own CSS, and a consumer importing
      // `@bdocs/theme-neutral/css` should not have to know which half of the
      // framework holds it.
      // The stylesheet ships as a real file, not as a bundled asset. A theme
      // consumed through a plain `<link>` — or through any bundler that does not
      // run Vite — gets the same file a Vite user does. `@import` inside it
      // resolves relative to `dist/`, so the components directory is copied
      // alongside rather than inlined.
      const src = path.resolve(__dirname, 'src/styles')
      const dest = path.resolve(__dirname, 'dist/styles')
      fs.cpSync(src, dest, { recursive: true })
      console.log('✓ styles copied to dist/styles')
    },
  }),
)
