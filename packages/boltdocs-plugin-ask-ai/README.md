# @bdocs/plugin-ask-ai

A secure, page-scoped streaming AI assistant for Boltdocs. Ships provider presets, hardened server adapters, rate limiting, and an optional floating UI.

## Install

```bash
pnpm add @bdocs/plugin-ask-ai
```

## Use

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import askAiPlugin from '@bdocs/plugin-ask-ai'

export default defineConfig({
  plugins: [
    askAiPlugin({
  title: 'Ask the docs',
  provider: 'openai',
  maxOutputTokens: 600,
  rateLimitPerMinute: 30,
}),
  ],
})
```

Requires an API key at build/serve time. See the plugin guide for server adapters and client customization.

## Docs

[Plugin guide](https://boltdocs.vercel.app/docs/plugins/content/plugin-ask-ai)
