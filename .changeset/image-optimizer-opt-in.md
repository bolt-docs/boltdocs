---
'boltdocs': patch
---

Make image optimization opt-in instead of mandatory

The image optimizer was imported at the top of the plugin module and injected
unconditionally, which made image processing a requirement for every project.
`sharp` and `svgo` are peer dependencies of the optimizer, so every installation
resolved and downloaded those native binaries whether or not a single image was
ever processed.

Enable it explicitly when a project wants it:

```ts
export default defineConfig({
  experimental: {
    imageOptimizer: true,
    // or, to also tune which files are processed:
    // imageOptimizer: { includePublic: false },
  },
})
```

The optimizer is resolved through `createRequire` inside the enabled branch, and
is no longer a dependency of the core package. A static import at module scope
would put the optimizer, and through it `sharp`, back into every load, so the
resolution has to stay guarded.

If the option is on but the package is not installed, the build warns and
continues without image optimization rather than failing: a project that asked
for an optimization gets a build without it, not a build that cannot produce.
