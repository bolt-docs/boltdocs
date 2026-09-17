import { error as logError, warn as logWarn } from '@bdocs/dui'
import type {
  CodeHighlighterAdapter,
  CodeHighlightConfig,
  CodeHighlighterEngine,
} from '../../shared/types'

/**
 * Factory signature used to produce a highlighter adapter.
 * Receives the resolved engine-agnostic config (`theme`, `options`).
 */
export type HighlighterFactory = (
  api: CodeHighlightConfig,
) => CodeHighlighterAdapter | Promise<CodeHighlighterAdapter>

export const DEFAULT_HIGHLIGHTER = 'shiki'

export const BUILTIN_HIGHLIGHTERS = [DEFAULT_HIGHLIGHTER] as const

/**
 * Registry of highlight engines. Registers only factories — engine modules
 * are imported lazily on first resolution, so unused engines never load.
 *
 * The built-in `'shiki'` engine is registered at module load but its module
 * (shiki + oniguruma + grammars) is only imported when actually resolved.
 */
const registry = new Map<string, HighlighterFactory>()

registry.set(DEFAULT_HIGHLIGHTER, async (api) => {
  const mod = await import('../mdx/shiki-adapter')
  return mod.getShikiAdapter({
    theme: {
      codeHighlighting: {
        engine: DEFAULT_HIGHLIGHTER,
        theme: api?.theme,
        options: api?.options,
      },
    },
  })
})

/**
 * Register (or replace) a highlight engine by id. Plugins use this to expose
 * custom engines through the core without touching any rendering code.
 */
export function registerHighlighter(
  name: string,
  factory: HighlighterFactory,
): void {
  registry.set(name, factory)
}

/**
 * Register an engine provided by a Boltdocs plugin. The plugin id (`plugin.name`)
 * becomes the selectable `theme.codeHighlighting.engine` value. Accepts either
 * a ready adapter instance or a factory, and never overrides a previously
 * registered engine so the first plugin wins deterministically.
 */
export function registerPluginHighlighter(
  name: string,
  provider:
    | CodeHighlighterAdapter
    | ((
        api: CodeHighlightConfig,
      ) => CodeHighlighterAdapter | Promise<CodeHighlighterAdapter>),
): void {
  if (registry.has(name)) return
  registry.set(name, async (api) =>
    typeof provider === 'function' ? provider(api) : provider,
  )
}

export function isHighlighterRegistered(name: string): boolean {
  return registry.has(name)
}

export function getHighlighterNames(): string[] {
  return [...registry.keys()]
}

function assertAdapter(
  adapter: unknown,
): asserts adapter is CodeHighlighterAdapter {
  if (
    !adapter ||
    typeof (adapter as CodeHighlighterAdapter)?.getOptions !== 'function' ||
    typeof (adapter as CodeHighlighterAdapter)?.initialize !== 'function'
  ) {
    throw new Error(
      '[boltdocs] Invalid highlighter adapter: expected `getOptions(lang, meta)` and `initialize()`',
    )
  }
}

/**
 * Resolve the active {@link CodeHighlighterAdapter} for a config.
 *
 * Resolution order:
 * 1. `engine` is a factory → call it with the resolved config
 * 2. `engine` is an adapter instance → validate and return it
 * 3. `engine` is a string → look up the registry (defaults to `'shiki'`);
 *    unknown ids warn and fall back to the built-in engine
 */
export async function getCodeHighlighterAdapter(
  config?: CodeHighlightConfig,
): Promise<CodeHighlighterAdapter> {
  const api: CodeHighlightConfig = {
    engine: config?.engine ?? DEFAULT_HIGHLIGHTER,
    theme: config?.theme,
    options: config?.options,
  }
  const engine = api.engine as CodeHighlighterEngine

  try {
    if (typeof engine === 'function') {
      const adapter = await engine(api)
      assertAdapter(adapter)
      return adapter
    }

    if (engine && typeof engine !== 'string') {
      assertAdapter(engine)
      return engine
    }

    const id =
      typeof engine === 'string' && engine.length > 0
        ? engine
        : DEFAULT_HIGHLIGHTER
    if (!registry.has(id)) {
      logWarn(
        `[boltdocs] Unknown highlighting engine "${id}". Falling back to "${DEFAULT_HIGHLIGHTER}".`,
      )
    }
    const factory = registry.get(id) ?? registry.get(DEFAULT_HIGHLIGHTER)!
    const adapter = await factory(api)
    assertAdapter(adapter)
    return adapter
  } catch (error) {
    logError(`[boltdocs] Failed to resolve highlighting engine:`, error)
    const fallback = registry.get(DEFAULT_HIGHLIGHTER)
    if (fallback) {
      try {
        const adapter = await fallback(api)
        assertAdapter(adapter)
        return adapter
      } catch {
        // Fall through and rethrow the original error below.
      }
    }
    throw error
  }
}

/**
 * Best-effort warmup of the selected engine. Never throws and is intended to
 * run off the critical path (e.g. right after the dev server listens).
 */
export async function prewarmCodeHighlighting(
  config?: CodeHighlightConfig,
): Promise<void> {
  try {
    const adapter = await getCodeHighlighterAdapter(config)
    if (typeof adapter.prewarm === 'function') {
      await adapter.prewarm(config?.options)
    }
  } catch {
    // Prewarm is best-effort by contract.
  }
}

/** Fire-and-forget wrapper for {@link prewarmCodeHighlighting}. */
export function prewarmHighlighter(config?: CodeHighlightConfig): void {
  void prewarmCodeHighlighting(config)
}
