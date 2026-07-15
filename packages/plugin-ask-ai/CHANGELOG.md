# @bdocs/plugin-ask-ai — Changelog

## 0.3.0

### Added

- **Declarative slots API.** New `slots` option maps directly to the core's
  `virtual:boltdocs-layout-slots` registry. Default mounts both `AskAiBubble`
  (`floating-bottom`) and `AskAiDialog` (`right-rail`) into the default docs
  layout — no manual composition required.
- **Per-slot toggles.** `askAiPlugin({ slots: { 'floating-bottom': false } })`
  mounts only the right-rail dialog; `slots: { 'right-rail': false }`
  keeps only the floating bubble.
- **`<DocsLayout.FloatingBottom>` / `<DocsLayout.RightRail>` slot primitives**
  upstream in `boltdocs` core, available since `boltdocs@3.3.0`.

### Deprecated

- `autoInject` is kept for backward compatibility but is now mapped
  internally to `slots`. Set `autoInject: false` to fully disable both
  mounts (equivalent to `slots: { 'floating-bottom': false, 'right-rail':
  false }`).

### Migration

| Before (0.2.x) | After (0.3.x) |
| --- | --- |
| `askAiPlugin()` with default `autoInject: true` | No change — both bubble and right-rail dialog mount automatically |
| `askAiPlugin({ autoInject: false })` then manually render `<AskAiBubble />` inside a custom layout | Set `autoInject: false` only if you render both components yourself; otherwise use `slots` to selectively enable either side |
| Mounting only via `components` MDX scope | Still supported; the plugin registers both `AskAiBubble` and `AskAiDialog` via the legacy `components` map so they remain available inside `.mdx` content |

### Security

- No changes to the security model. The 7-layer defense described in
  `SECURITY.md` (input caps, denylist, delimiter hardening, system prompt,
  rate limit, deployment network contract, forwarded-context cap) still
  applies.

## 0.2.0

Initial public release with OpenAI SDK rewrite. See git history.
