import { defineConfig, licenseBanner, packageConfig } from 'tsdown-config'

export default defineConfig(
  packageConfig({
    // `index` is the surface a theme and a plugin render against. `router` is
    // the router primitives on their own. `app` is what the build drives: the
    // route table, the shell and the page renderer, kept apart so a reader's
    // first visit downloads the theme, not the route builder.
    entry: {
      index: 'src/index.ts',
      router: 'src/router-entry.ts',
      app: 'src/app/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    // Same three reasons as `@bdocs/primitives`: the JSDoc belongs in the source
    // and the `.d.mts`; `legal` stays on because this is a published MIT package;
    // and minifying is a disk win rather than a page-speed one, since consumers
    // re-bundle this file anyway.
    outputOptions: { comments: { jsdoc: false } },
    minify: true,
    banner: { js: licenseBanner },
    tsconfig: './tsconfig.json',
    deps: {
      neverBundle: ['react', 'react-dom'],
    },
  }),
)
