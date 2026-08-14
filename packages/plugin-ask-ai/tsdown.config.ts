import { defineConfig, packageConfig } from 'tsdown-config'

export default defineConfig(
  packageConfig({
    entry: {
      'node/index': 'src/node/index.ts',
      'client/index': 'src/client/index.ts',
      'server/index': 'src/server/index.ts',
    },
    format: ['esm'],
    dts: true,
    clean: true,
    tsconfig: './tsconfig.json',
    deps: {
      neverBundle: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'vite',
        'boltdocs',
        'boltdocs/client',
      ],
    },
  }),
)
