# @bdocs/dui

## 0.1.2

### Patch Changes

- [`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **Accurate Unicode width rendering**: Replaced naive length checks with `string-width` calculations to prevent box layout misalignment in CLI reporting when emoji or multi-byte characters are displayed.

## 0.1.1

### Patch Changes

- [`a780571`](https://github.com/bolt-docs/boltdocs/commit/a78057165a087b36793ceced3bf5799631b9261a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat(dui): add `configure()`/`getConfig()` for runtime identity — log prefix, server box titles, and update command are now configurable at the CLI entry point instead of hardcoded. fix(dui): default `updateCommand` corrected from `@bdocs/dui` to `boltdocs`. fix(dui): `stripAnsi()` now handles OSC hyperlinks and CSI cursor sequences, not just SGR colors. refactor(dui): `devServer()`/`previewServer()` consolidated via shared `buildServerBox()` helper. chore(dui): `padLeft` renamed to `padRight` for clarity. chore(dui): comprehensive tests added for logger, config, confirm, and formatLog. fix(ssg): missing kolorist-to-dui migration in `build.ts` (`dim`, `cyan`, `green`, `gray`, `red` bare calls) resolved — fixes runtime `ReferenceError: gray is not defined`. fix(core): `dev-server.ts` `console.error('[boltdocs]')` → `dui.error()`; `cli-entry.ts` adds `configure()` call.

- [`375264f`](https://github.com/bolt-docs/boltdocs/commit/375264fb24912fa51da39ccb9fbc78b3a4962b72) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Remove `ansiCodes` raw ANSI export from `@bdocs/dui`. Core CLI `ui.ts` now re-exports `dui.colors` (picocolors) directly — no more ANSI escape code usage anywhere. `formatLog` and `confirm` use picocolors functions.

- [`b736267`](https://github.com/bolt-docs/boltdocs/commit/b736267f8764ab92f9b4fb3ee1f9f0b0bd07e6e0) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix picocolors usage across `@bdocs/dui` (use function calls instead of template literal interpolation). Add `ansiCodes` export for backward-compatible raw ANSI sequences. Migrate doctor output to use `@bdocs/dui` — replace raw ANSI with picocolors functions and use `dui.box.double()` for diagnosis summary.

- [`f478f53`](https://github.com/bolt-docs/boltdocs/commit/f478f539a6da7a32c9ecef44fda0013b7b478133) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Complete migration from `ui.ts` wrapper to direct `@bdocs/dui` imports across core. Move `confirm`/`formatLog` into dui. Remove `ui.ts` entirely. Phase 3: migrate changelog generator output to dui logger/box.

- [`f0be317`](https://github.com/bolt-docs/boltdocs/commit/f0be317824d34e6827284a342af946de53396c18) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Create `@bdocs/dui` terminal UI package with boxes, logger, lists, and dividers. Wire into core CLI (`ui.ts`) and update-check (`update-check.ts`).
