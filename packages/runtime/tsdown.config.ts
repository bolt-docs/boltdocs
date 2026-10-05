import { defineConfig, licenseBanner, packageConfig } from 'tsdown-config'

export default defineConfig(
  packageConfig({
    entry: {
      index: 'src/index.ts',
      router: 'src/router-entry.ts',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    // Same reasoning as `@bdocs/primitives`: the JSDoc belongs in the source and
    // in `dist/index.d.mts`, not shipped a third time inside the module.
    // `legal` stays on because this is a published MIT package.
    outputOptions: { comments: { jsdoc: false } },
    banner: { js: licenseBanner },
    tsconfig: './tsconfig.json',
    deps: {
      neverBundle: ['react', 'react-dom'],
    },
  }),
)
