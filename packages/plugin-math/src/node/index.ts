import type { BoltdocsPlugin } from 'boltdocs'
import { transformSource } from './source-transform'

export default function mathPlugin(): BoltdocsPlugin {
  return {
    name: 'boltdocs-plugin-math',
    version: '0.1.0',
    hooks: {
      transformSource,
    },
    components: {
      Math: '@bdocs/plugin-math/client',
      MathComponent: '@bdocs/plugin-math/client',
      BlockMath: '@bdocs/plugin-math/client',
    },
  }
}
