---
'boltdocs': patch
'@bdocs/ssg': patch
'@bdocs/processor-satteri': patch
'@bdocs/react-binding': patch
---

Close the gaps found in the post-4.0 audit:

- Drop `@bdocs/grammars` and the four unused required `@shikijs/*` peer deps
  from the engine — roughly 3 MB of install weight for code nothing imports.
  The grammars package is removed entirely: it was never published to npm and
  had no consumers, so the vendored TextMate data goes away with 4.0.
- Align SSG's `@bdocs/dui` with `^0.6.0` so runtime configuration is shared.
- `await` async remark transformers instead of silently dropping them, and
  warn when a transformer throws instead of swallowing the error.
- Wire the six omitted suites into `test:all` and add a real smoke test for
  `@bdocs/react-binding`.
- Fix the pre-commit hook: markdownlint no longer runs on generated
  CHANGELOGs, which previously made every commit fail.
- Add test/typecheck/boundary gates to the release workflow and the missing
  Node/pnpm setup to the `build-wasm` CI job.
- Add `license`, `repository` and `publishConfig` to publishable manifests so
  the plugin audit no longer reports false provenance findings.
- Correct the docs and agent references that still described Shiki as the
  built-in highlighting engine; it is now Prism (`@bdocs/highlight`).
