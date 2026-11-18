import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, licenseBanner, packageConfig } from 'tsdown-config'

export default defineConfig(
  packageConfig({
    // Two entries on purpose: `composition` is the style-neutral slot layer and
    // keeps the search dialog behind a dynamic import. Merging it into `index`
    // hoists that import into the first visit.
    entry: {
      index: 'src/index.ts',
      composition: 'src/composition/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    outputOptions: { comments: { jsdoc: false } },
    minify: true,
    banner: { js: licenseBanner },
    tsconfig: './tsconfig.json',
    deps: {
      neverBundle: ['react', 'react-dom'],
    },
    async onSuccess() {
      const src = path.resolve(__dirname, 'src/styles')
      const dest = path.resolve(__dirname, 'dist/styles')
      fs.cpSync(src, dest, { recursive: true })
      console.log('✓ styles copied to dist/styles')
    },
  }),
)
