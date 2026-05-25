# @bdocs/dui — Implementation Phases

This document tracks the gradual migration of terminal output across the Boltdocs monorepo to use `@bdocs/dui` as the single source of truth for all CLI/styled output.

---

## Phase 0: Package creation ✅

- [x] Scaffold `packages/dui/` (package.json, tsdown.config.ts, tsconfig.json)
- [x] Implement `colors.ts` — picocolors wrapper
- [x] Implement `utils.ts` — padCenter, padLeft, fitWidth, terminalWidth, stripAnsi
- [x] Implement `logger.ts` — info, warn, error, success, debug
- [x] Implement `divider.ts` — configurable terminal divider
- [x] Implement `list.ts` — bullet, ordered, tasks
- [x] Implement `box.ts` — builder + pre-built (devServer, previewServer, updateAvailable)
- [x] Implement `index.ts` — barrel exports
- [x] Build passes
- [x] README.md

---

## Phase 1: Core CLI — `packages/core/src/node/cli/ui.ts` ✅

Replace the ANSI-raw `ui.ts` with wrappers around `@bdocs/dui`. Keep the same public API so nothing breaks.

- [x] `colors` → re-export `dui.colors` (picocolors)
- [x] `info/warn/error/success/divider/box` → delegate to `dui.logger.*` and `dui.box.*`
- [x] `printDevServerInfo` / `printPreviewServerInfo` → delegate to `dui.*`
- [x] `confirm` → keep as-is (prompt logic), use picocolors for styling
- [x] Remove copy of `padCenter`/`padLeft` from `update-check.ts` → use `dui.*`
- [x] Remove copy of `renderUpdateBox` from `update-check.ts` → use `dui.updateAvailable`
- [x] `notifyUpdateAvailable` → use `dui.updateAvailable`
- [x] Verify 0 regressions in tests
- [x] Remove raw ANSI escape codes (`ansiCodes`) from dui and ui.ts — all code uses picocolors functions

---

## Phase 2: Core Doctor — `packages/core/src/node/cli/doctor/` ✅

- [x] Doctor issue display → use picocolors functions via `@bdocs/dui`
- [x] Doctor summary → use `dui.box.double()`
- [x] Remove direct ANSI usage in `doctor/index.ts`
- [x] Remove `ui.colors` usage in `checkers.ts` → use `colors` from `@bdocs/dui`

---

## Phase 3: Core Changelog — `packages/core/src/node/changelog/` ✅

- [x] `console.log('📄 Reading...')` → `dui.logger.info`
- [x] `console.warn('⚠️...')` → `dui.logger.warn`
- [x] `console.log('✅ Generated...')` → `dui.logger.success`
- [x] Use `dui.box.double()` for summary output

---

## Phase 4: Core Plugin/Debug Logging ✅

- [x] `plugin/dev-server.ts` raw `console.error` → `dui.logger.error` (already using `dui.error()`)
- [x] `plugin-lifecycle.ts` raw `console.log/warn/error` → `dui.logger.*`
- [x] `plugin-sandbox.ts` → `dui.logger.warn`
- [x] `config.ts` → `dui.logger.warn`
- [x] `meta-loader.ts` — fix `[Boltdocs]` → `dui.logger.*`
- [x] `utils.ts` `logSecurityEvent` → `dui.logger.error`
- [x] `colorMap` unused export removed from `@bdocs/dui`
- [x] `warn()` updated to accept optional `err` param (match `error()` API)
- [x] All 433 tests pass, 34 test files

---

## Phase 5: SSG — `packages/ssg/`

Replace `kolorist` with `@bdocs/dui`:

- [ ] `ssg/src/node/utils.ts` `buildLog()` → `dui.logger.info` with `[boltdocs]` prefix
- [ ] `ssg/src/node/build.ts` all console calls → `dui.logger.*` / `dui.colors`
- [ ] `ssg/src/node/dev.ts` `printServerInfo()` → `dui.box.devServer()`
- [ ] `ssg/src/node/cli.ts` → `dui.logger.*`
- [ ] Remove `kolorist` dependency from `@bdocs/ssg`

---

## Phase 6: create-boltdocs — `packages/create-boltdocs/`

Replace `picocolors` direct use with `@bdocs/dui`:

- [ ] `create-boltdocs/src/index.ts` all console calls → `dui.logger.*`
- [ ] Colors via `dui.colors` instead of direct picocolors
- [ ] Could keep picocolors as transitive dep via dui

---

## Phase 7: plugin-mermaid — `packages/plugin-mermaid/`

- [ ] Node-side console output → `dui.logger.*`
- [ ] Client-side stays as-is (can't use node-only dui in browser)

---

## Phase 8: Client-side considerations

- [ ] Evaluate if a browser-safe subset of `dui` is needed
- [ ] If yes, split into `@bdocs/dui/node` and `@bdocs/dui/client`
- [ ] If no, leave as node-only

---

## Legend

| Status | Meaning |
|--------|---------|
| `✅` | Done |
| `🔄` | In progress |
| `⬜` | Not started |
| `❌` | Blocked |
