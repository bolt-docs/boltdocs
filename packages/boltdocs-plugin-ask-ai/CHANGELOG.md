# @bdocs/plugin-ask-ai — Changelog

## 0.5.0

### Minor Changes

- 5f7a09c: Vite 8.3.5, and only Vite 8.3.

  The framework now builds on Vite 8.3.5 and requires it. The peer dependency
  range moved from `^8.1.0` to `^8.3.0`, so a site on Vite 8.1 or 8.2 has to
  update before it can install the new Boltdocs.

  Two version checks went away with it, because the versions they served no
  longer exist:
  - The build used to choose between `build.rolldownOptions` and
    `build.rollupOptions` depending on the installed Vite. Vite 8 is Rolldown,
    and the two option names are not interchangeable — the options moved with
    the bundler, not with the options — so the check only ever chose the wrong
    one for a Vite it did not support anyway.
  - The build used to look for the manifests in the output root on Vite before
    5, which had no `.vite` directory. There is no such Vite left to support.

  The output does not change: the documentation site's 260 pages are byte for
  byte identical across the two versions, and the client bundle grows by four
  bytes.

  `@types/node` moved from 22.0.0 to 22.12.0 across the workspace, which is
  what Vite 8.3 asks for, and an override pins it so the whole tree resolves
  one copy.

### Patch Changes

- 4a2de60: The engine no longer ships the UI layer.

  Until 4.0 the `boltdocs` package carried the whole client stack: the layout,
  the components, the contexts, the router and the MDX components. A site got
  all of it by installing the engine, and reached it through `boltdocs/client`,
  `boltdocs/primitives` and `boltdocs/mdx`.

  In 4.0 the engine is the engine.

  ### What moved
  - The client code — the route builder, the shell, the MDX page, the collection
    routes — is now in `@bdocs/theme-neutral`. It renders the theme's
    components, so the engine could not keep it without depending on a theme.
  - `boltdocs` no longer exports `./client`, `./client/router`, `./primitives` or
    `./mdx`. It publishes the engine: the CLI, the config, the route generation,
    the plugin lifecycle, the SSG bridge (`./ssg`) and the engine stylesheet
    (`./theme/reset.css`).
  - The theme is resolved from the project, not from the engine. `themePackage`
    in the configuration names it (default `@bdocs/theme-neutral`), and the
    engine imports the route surface from it. A second theme is a second
    package, not a fork of the engine.

  ### What a site has to do

  ```bash
  pnpm add @bdocs/theme-neutral
  npx boltdocs migrate --apply
  ```

  The command splits a `boltdocs/client` import by name: every symbol goes to
  the package that exports it — components, layout and MDX components to
  `@bdocs/theme-neutral`, the router and the contexts to `@bdocs/runtime`. It
  rewrites the import examples in Markdown as well, and it adds the theme to
  the manifest.

  | 3.x                                           | 4.0                                |
  | --------------------------------------------- | ---------------------------------- |
  | `boltdocs/client` (components, layout, hooks) | `@bdocs/theme-neutral`             |
  | `boltdocs/client` (router, contexts)          | `@bdocs/runtime`                   |
  | `boltdocs/primitives`                         | `@bdocs/theme-neutral/composition` |
  | `boltdocs/mdx`                                | `@bdocs/theme-neutral`             |
  | `boltdocs/client/router`                      | `@bdocs/runtime/router`            |

  ### How the two halves still meet

  The generated per-site artifacts — the icon registry, the page-source fetcher,
  the search index, the site's `layout.tsx`, the plugin slots and the site's own
  MDX components — reach the theme through the runtime's site bridge, which the
  engine fills from a generated `virtual:boltdocs-site-bridge` module. The
  theme still mentions no virtual module, which is what lets it be installed on
  its own.

  The official plugins were moved the same way: a plugin's client code imports
  `@bdocs/runtime` for the contexts and `@bdocs/primitives` for the style-neutral
  helpers, so a plugin works with whatever theme the site uses.

- d80c6e1: Every package type checks.

  `tsc --noEmit` is now clean in all twenty-three packages that have a
  `tsconfig.json`. The core, the runtime, the contracts, the primitives, the
  theme, the processor, the unist utils, the SSG and every official plugin.

  ### Most of the errors were configuration, not code

  Eight packages extended the repository's root `tsconfig.json` — a solution
  file with no compiler options. The type checker fell back to its defaults: no
  `module`, no `target`, no `esModuleInterop`, no `jsx`. It reported 39 errors
  that had nothing to do with the code, and hid the real ones behind them.

  The base is now `tsconfig.base.json`, and the root solution file extends it so
  that a package which extends the root gets the same options as one that
  configures itself. The three plugins that had no `tsconfig` at all have one
  now.

  ### Two copies of Vite

  `@types/node` was a range in some packages and an exact version in others, and
  the version is part of the peer variant a package resolves against. Three
  copies of the same Vite were installed, and their `Plugin` types were not the
  same type. Every package now pins the same version, and there is one copy.

  ### Four bugs the type checker had been reporting for months
  - The Algolia plugin sent the batch action `delete`. Algolia's endpoint takes
    `deleteObject`; every stale-record removal would have failed.
  - The Tailwind and UnoCSS plugins wrapped the plugin list in another array.
    Vite flattens nested lists, so it worked — and the engine received a list of
    lists.
  - The Mermaid plugin passed an object to a class-name helper that only joins
    strings, which would have rendered `[object Object]` as a class.
  - The theme's code block called a function that was renamed when its state
    module was split out.

  ### A flake, fixed

  `@bdocs/plugin-ssg`'s critical-dependency test used `vi.doMock` with a dynamic
  import, and the mock only applied when the module had not been loaded yet —
  which depended on which test file ran first. The test resets the module
  registry now, and it passes in any order.

- Fixed a critical compatibility bug: the engine read the **monorepo root**
  package version (1.11.0) instead of its own (3.4.1) when checking plugin
  ranges. That silently failed every plugin validation, and the swallowed error
  dropped all extra Vite plugins — including Tailwind — so docs utility classes
  were never generated. Version resolution now walks up by package name, and the
  validation error is logged instead of swallowed.

  Enforce SPEC §2.3: `boltdocs audit` now runs as a preflight for both `build`
  and `dev`, and fails the command on unresolved plugins, scan errors, truncated
  scans or high-risk findings. Every shipped plugin declares `version` and
  `boltdocsVersion`, and the validator requires them. Plugin identity can name a
  different package via `packageName` (used by git-meta's two exports).

  The scanner now treats spawning/forking a fixed local process as a warning and
  reserves `high` for shell execution; Mermaid no longer auto-installs Chromium
  with `npx` behind the user's back. The metadata version check compares the
  engine version against the plugin's supported range instead of the plugin's own
  version. CI runs `boltdocs audit` after building.

- Updated dependencies [1413a37]
- Updated dependencies [7628363]
- Updated dependencies [4a2de60]
- Updated dependencies [4fb6ed1]
- Updated dependencies [cdd636a]
- Updated dependencies [3ad10bb]
- Updated dependencies [4fb6ed1]
- Updated dependencies [80b8bba]
- Updated dependencies [94aebbc]
- Updated dependencies [cf79338]
- Updated dependencies [ffb5e55]
  - @bdocs/contracts@0.2.0
  - @bdocs/runtime@1.1.0

## 0.4.0

### Minor Changes

- [`1d62dac`](https://github.com/bolt-docs/boltdocs/commit/1d62dac2bc237a919df6a89d5ebf7c94a94f742b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Boltdocs 3.4.0 — architecture contracts and incremental build foundation.

  This release publishes the new `@bdocs/contracts` package as the framework-neutral
  contract layer for routes, plugin lifecycle, plugin definitions, highlighting,
  search documents, and configuration. Its first public version is **`0.1.0`**
  (kept pre-1.0 while 4.0 reshapes the seam). `boltdocs` now re-exports those
  contracts so the existing 3.x public API keeps working unchanged.

  Highlights:
  - introduce `@bdocs/contracts` with route, plugin, lifecycle, highlighting, and configuration contracts;
  - keep `boltdocs` exports backward compatible through re-exports;
  - make `@bdocs/processor-satteri` consume the shared lifecycle contract directly;
  - align `@bdocs/ssg` and `@bdocs/plugin-ask-ai` on the new contract boundary;
  - ship the Vite 8.1 toolchain alignment and the content-addressed SSG page cache;
  - avoid full-site re-render on a single page edit.

## 0.3.1

### Patch Changes

- [`682d0c1`](https://github.com/bolt-docs/boltdocs/commit/682d0c1252097491faf3752e3337ea681271a3e0) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Finish the Ask AI integration: restore public plugin metadata and floating client slots, harden provider routing and server errors, enforce request/input limits across every adapter, add a customizable accessible chat UI, and expand security and DOM regression coverage.

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
