---
'boltdocs': major
---

Drop the CommonJS build. The published tarball goes from **5.84 MB to 2.93 MB** (−49.8%), 195 files to 100.

| | before | after |
| --- | --- | --- |
| tarball | 5.84 MB (195 files) | 2.93 MB (100 files) |
| outputs | ESM + CJS | ESM |

The CJS build was 2.87 MB — 49% of the tarball — and nothing resolved to it. The package was already `"type": "module"`, the `boltdocs` binary is ESM, and every consumer in the ecosystem (Vite, Rolldown, RSC, Node itself) takes the ESM path.

### Breaking

A CommonJS consumer must convert to ESM. There is no `require` condition on any export, so this fails loudly at resolve time (`ERR_PACKAGE_PATH_NOT_EXPORTED`) rather than halfway through someone's build. From CommonJS, `await import('boltdocs')` works today.

### Why the exports use `default` rather than `import`

```jsonc
".": {
  "types": "./dist/node/index.d.ts",
  "default": "./dist/node/index.mjs"
}
```

With only one format left, `default` is what Node's resolver matches for both `import` and `require`. Keeping the key named `import` would have left a `require()` reaching an `.mjs` file and failing at parse instead of at resolve.

### Guarded by a test

`tests/package-format.test.ts` asserts `type: module`, that no export declares a `require` condition, that every declared export target exists in `dist`, and that no `.cjs` file is present. The third assertion is the one that matters: it walks the built output rather than trusting the manifest, because a stale `require` condition pointing at a file the build no longer produces is exactly what a config-only change leaves behind.
