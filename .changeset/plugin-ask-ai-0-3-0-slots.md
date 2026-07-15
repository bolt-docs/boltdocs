---
'@bdocs/plugin-ask-ai': minor
---

v0.3.0 — declarative slot support, hardened system prompt with `RULE 0` priority hierarchy, `customModels` allowlist escape hatch. `AskAiBubble` and `AskAiDialog` now auto-mount into the `floating-bottom` and `right-rail` slots respectively (consumed by the core's `virtual:boltdocs-layout-slots`). Legacy `autoInject` flag remains for back-compat. New `slots` option allows per-mount toggling. The system prompt is delimiter-aware (`<<<DOCS_START>>>` / `<<<DOCS_END>>>`), explicit about refusal categories (a)–(e), and refuses any override attempt with the literal string `"Not in docs."`.
