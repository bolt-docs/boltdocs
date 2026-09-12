import type { BoltdocsPlugin } from 'boltdocs'
import { info, warn } from '@bdocs/dui'
import { buildSystemPrompt } from './prompts'
import { DEFAULT_DENY_PATTERNS } from './safety'
import { createAskAiMiddleware, type MiddlewareConfig } from './middleware'
import {
  AskAiPluginOptionsSchema,
  PROVIDER_PRESETS,
  buildClientMetadata,
  type AskAiPluginOptions,
} from './options'

export { DEFAULT_SYSTEM_PROMPT, buildSystemPrompt } from './prompts'
export {
  PROVIDERS,
  PROVIDER_PRESETS,
  AskAiPluginOptionsSchema,
  buildClientMetadata,
  type AskAiClientMetadata,
  type AskAiPluginOptions,
  type Provider,
  type ProviderPreset,
} from './options'

const CLIENT_PACKAGE = '@bdocs/plugin-ask-ai/client'

export default function askAiPlugin(
  rawOptions: AskAiPluginOptions = {},
): BoltdocsPlugin {
  const options = AskAiPluginOptionsSchema.parse(rawOptions)
  const {
    autoInject,
    provider,
    model,
    endpoint,
    baseURL,
    systemPrompt,
    systemPrompts,
    persona,
    temperature,
    topP,
    maxInputChars,
    maxOutputTokens,
    contextChars,
    rateLimitPerMinute,
    secretKey,
    devMode,
  } = options

  const providerPreset = PROVIDER_PRESETS[provider]
  const effectiveBaseURL = baseURL || providerPreset.baseURL
  const providerEnvKey = providerPreset.envKey
  // A per-provider prompt wins, then a global override, then the default —
  // optionally composed with the custom `persona` identity/tone block.
  const promptOverride = systemPrompts?.[provider] ?? systemPrompt
  const effectiveSystemPrompt = promptOverride ?? buildSystemPrompt(persona)
  const effectiveDevMode = devMode || process.env.NODE_ENV !== 'production'

  if (!process.env[providerEnvKey]) {
    warn(
      `[Ask AI] ${providerEnvKey} is not set. The ${endpoint} endpoint will respond with an error until you set it.`,
    )
  } else {
    info(
      `[Ask AI] Initialized — provider=${provider}, model=${model}, endpoint=${endpoint}, maxOutputTokens=${maxOutputTokens}, rateLimit=${rateLimitPerMinute}/min, devMode=${effectiveDevMode}`,
    )
  }

  const middlewareConfig: MiddlewareConfig = {
    provider,
    model,
    endpoint,
    systemPrompt: effectiveSystemPrompt,
    maxInputChars,
    maxOutputTokens,
    contextChars,
    denyPatterns: DEFAULT_DENY_PATTERNS,
    baseURL: effectiveBaseURL,
    providerEnvKey,
    rateLimitPerMinute,
    secretKey,
    devMode: effectiveDevMode,
    temperature,
    topP,
  }

  return {
    name: 'boltdocs-plugin-ask-ai',
    version: '0.3.0',
    client: {
      slots: autoInject
        ? {
            'floating:after': `${CLIENT_PACKAGE}#AskAiBubble`,
          }
        : undefined,
    },
    metadata: buildClientMetadata(options) as Record<string, unknown>,
    vitePlugins: [
      {
        name: 'vite-plugin-boltdocs-ask-ai-middleware',
        configureServer(server) {
          server.middlewares.use(
            createAskAiMiddleware(middlewareConfig, server.config.root),
          )
        },
        configurePreviewServer(server) {
          server.middlewares.use(
            createAskAiMiddleware(middlewareConfig, server.config.root),
          )
        },
      },
    ],
  } satisfies BoltdocsPlugin
}
