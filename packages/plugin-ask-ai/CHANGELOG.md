# @bdocs/plugin-ask-ai — Changelog

## 0.3.0

### Minor Changes

- [`6904710`](https://github.com/bolt-docs/boltdocs/commit/6904710df233ff29193adcbb746c4d16011255d3) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat(ask-ai): multi-provider support, dev-mode token chip, `useConfig`-driven client config.

  **Provider preset table** — 12 providers wired up via `provider: '<name>'` option:

  | `provider`   | Default `baseURL`                | Default model                    | Env var                |
  | ------------ | -------------------------------- | -------------------------------- | ---------------------- |
  | `openai`     | `https://api.openai.com/v1`      | `gpt-4o-mini`                    | `OPENAI_API_KEY`       |
  | `anthropic`¹ | _(unset, see note)_              | `claude-3-5-haiku-latest`        | `ANTHROPIC_API_KEY`    |
  | `gemini`¹    | _(unset, see note)_              | `gemini-2.0-flash-exp`           | `GEMINI_API_KEY`       |
  | `mistral`    | `https://api.mistral.ai/v1`      | `mistral-small-latest`           | `MISTRAL_API_KEY`      |
  | `cohere`     | `https://api.cohere.ai/v1`       | `command-r-plus`                 | `COHERE_API_KEY`       |
  | `deepseek`   | `https://api.deepseek.com/v1`    | `deepseek-chat`                  | `DEEPSEEK_API_KEY`     |
  | `groq`       | `https://api.groq.com/openai/v1` | `llama-3.1-8b-instant`           | `GROQ_API_KEY`         |
  | `openrouter` | `https://openrouter.ai/api/v1`   | `openai/gpt-4o-mini`             | `OPENROUTER_API_KEY`   |
  | `together`   | `https://api.together.xyz/v1`    | `meta-llama/Llama-3-70b-chat-hf` | `TOGETHER_API_KEY`     |
  | `ollama`     | `http://localhost:11434/v1`      | `llama3.2`                       | `OLLAMA_API_KEY`       |
  | `azure`¹     | _(required)_                     | `gpt-4o-mini`                    | `AZURE_OPENAI_API_KEY` |
  | `custom`¹    | _(required)_                     | `gpt-4o-mini`                    | `OPENAI_API_KEY`       |

  ¹ Anthropic, Gemini, Azure, and Custom providers require a user-supplied `baseURL` (e.g. OpenRouter, LiteLLM, Cloudflare AI Gateway as an OpenAI-compatible proxy). The plugin only speaks the OpenAI Chat Completions wire format.

  **New options:**
  - `provider` — provider preset name (default `'openai'`).
  - `systemPrompts` — per-provider system-prompt override map. Matching provider key wins over global `systemPrompt`.
  - `devMode` — when `true`, the chat UI renders a token-consumption chip (`provider/model`, prompt/completion/total tokens, elapsed ms) below each assistant response. Auto-enabled when `process.env.NODE_ENV !== 'production'`.

  **Client config refactor:** `useAskAi` now reads runtime options via the `useConfig()` hook and the new plugin `metadata` field, replacing the previous `virtual:boltdocs-config` import. The `metadata?: Record<string, unknown>` field was added to both `BoltdocsPlugin` and `SecureBoltdocsPlugin` in core to make this type-safe.

  **Security:** `SECURITY.md` rewritten to document all 12 providers, the dev-mode chip, and the new `metadata` exposure contract.

  **Other fixes:**
  - `handler.ts`: API key lookup now uses `providerEnvKey` instead of hardcoded `OPENAI_API_KEY`.
  - `ServerResponse` import moved from `vite` to `node:http`.
  - Adapter `eventToSse` switches now have a default case (TS2366).
  - Middleware narrows `question` to `string` via local `safeQuestion` (TS2322 fix).

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

| Before (0.2.x)                                                                                     | After (0.3.x)                                                                                                                                             |
| -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `askAiPlugin()` with default `autoInject: true`                                                    | No change — both bubble and right-rail dialog mount automatically                                                                                         |
| `askAiPlugin({ autoInject: false })` then manually render `<AskAiBubble />` inside a custom layout | Set `autoInject: false` only if you render both components yourself; otherwise use `slots` to selectively enable either side                              |
| Mounting only via `components` MDX scope                                                           | Still supported; the plugin registers both `AskAiBubble` and `AskAiDialog` via the legacy `components` map so they remain available inside `.mdx` content |

### Security

- No changes to the security model. The 7-layer defense described in
  `SECURITY.md` (input caps, denylist, delimiter hardening, system prompt,
  rate limit, deployment network contract, forwarded-context cap) still
  applies.

## 0.2.0

Initial public release with OpenAI SDK rewrite. See git history.
