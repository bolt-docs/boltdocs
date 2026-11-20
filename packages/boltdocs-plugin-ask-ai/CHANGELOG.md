# @bdocs/plugin-ask-ai — Changelog

## 0.5.0

### Minor Changes

- Vite 8.3.5, and only Vite 8.3.

### Patch Changes

- The engine no longer ships the UI layer.
- Every package type checks.
- Fixed a critical compatibility bug: the engine read the **monorepo root** package version (1.11.0) instead of its own (3.4.1) when checking plugin ranges.

## 0.4.0

### Minor Changes

- Boltdocs 3.4.0 — architecture contracts and incremental build foundation.

## 0.3.1

### Patch Changes

- Finish the Ask AI integration: restore public plugin metadata and floating client slots, harden provider routing and server errors, enforce request/input limits across every adapter, add a customizable accessible chat UI, and expand security and DOM regression coverage.

## 0.3.0

### Minor Changes

- feat(ask-ai): multi-provider support, dev-mode token chip, `useConfig`-driven client config.

### Added

- **Declarative slots API.** New `slots` option maps directly to the core's `virtual:boltdocs-layout-slots` registry.
- **Per-slot toggles.** `askAiPlugin({ slots: { 'floating-bottom': false } })`
- **`<DocsLayout.FloatingBottom>` / `<DocsLayout.RightRail>` slot primitives** upstream in `boltdocs` core, available since `boltdocs@3.3.0`.

### Deprecated

- `autoInject` is kept for backward compatibility but is now mapped internally to `slots`. Set `autoInject: false` to fully disable both mounts (equivalent to `slots: { 'floating-bottom': false, 'right-rail': false }`).

### Migration

### Security

- No changes to the security model. The 7-layer defense described in `SECURITY.md` (input caps, denylist, delimiter hardening, system prompt, rate limit, deployment network contract, forwarded-context cap) still applies.

## 0.2.0
