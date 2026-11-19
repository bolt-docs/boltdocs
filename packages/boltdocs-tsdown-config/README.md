# `tsdown-config`

> **Internal — not published to npm.** `private: true`.

Shared `tsdown` preset for every package in the Boltdocs workspace. It centralizes the ESM/CJS output layout, declaration generation, license banner and minification defaults so all packages build identically.

## Use

Every workspace package references it as a devDependency:

```ts title="packages/*/tsdown.config.ts"
import { defineConfig, packageConfig } from 'tsdown-config'

export default defineConfig(packageConfig({ entry: ['src/index.ts'] }))
```

As a consumer of published Boltdocs packages you never install or import this package — the build configuration is applied before publishing and is not part of any shipped artifact.
