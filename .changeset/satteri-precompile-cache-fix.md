---
'@bdocs/processor-satteri': patch
---

Fix two silent bugs that disabled the MDX precompile cache on every build

- **Absolute `docsDir` corrupted the precompile scan path** — core passes a resolved absolute `docsDir`, but the plugin joined it onto the Vite root (`path.join(root, docsDir)`), producing a nonexistent path. `fs.existsSync` failed silently and the whole precompile pass (and its worker pool) was skipped on every build. Now uses `path.resolve`, which handles both relative and absolute paths.
- **Per-process nonce invalidated the manifest `globalKey`** — non-persistent user plugins were signed with a `pid:Date.now():Math.random()` nonce baked into the compiler signature, so the manifest key differed on every process and the on-disk compiled-MDX cache could never produce a hit: all pages were recompiled on every build. The nonce is replaced by the stable `__boltdocsCacheSignature` (name@version:options) identity marker.

Measured on the 259-page docs site: warm builds now report `precompile: 231 hit / 0 miss / 1.5s` instead of recompiling the full site invisibly on every build.
