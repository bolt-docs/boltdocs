---
"@bdocs/ssg": patch
---

Replace `kolorist` with `@bdocs/dui` for all terminal output. Migrates `build.ts`, `dev.ts`, `cli.ts`, `utils.ts` (buildLog), `vite-plugin/index.ts`, `state.ts`, and `invariant.ts` — all `console.*` calls replaced with `dui.logger.*` and all `kolorist` colors replaced with `dui.colors`. Removes `kolorist` dependency.
