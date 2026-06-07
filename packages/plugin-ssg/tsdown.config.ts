import { defineConfig } from 'tsdown'

const commonConfig = {
  format: ['esm', 'cjs'],
  dts: true,
  clean: false,
  minify: true,
  alias: {
    '~': './src',
  },
  deps: {
    skipNodeModulesBundle: true,
  },
}

export default defineConfig([
  {
    ...commonConfig,
    entry: {
      index: 'src/index.ts',
      node: 'src/node/index.ts',
    },
    platform: 'node',
    clean: true,
    shims: true,
  },
  {
    ...commonConfig,
    entry: {
      'client/single-page': 'src/client/single-page.tsx',
    },
    platform: 'browser',
  },
  {
    ...commonConfig,
    entry: {
      'style-collectors/styled-components':
        'src/style-collectors/styled-components.ts',
    },
    platform: 'node',
  },
])
