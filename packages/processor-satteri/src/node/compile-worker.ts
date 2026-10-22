/**
 * P2-22: Compile worker — runs in a Node.js worker_thread to parallelize
 * Sätteri MDX compilation across CPU cores.
 *
 * Each worker imports satteri + esbuild once (expensive init) and then
 * handles compile requests via message passing.
 *
 * Built-in plugins (remark-meta, rehype-slug, rehype-shiki) are imported
 * directly.  A user plugin that describes its hook for a worker is rebuilt
 * here; one that does not is handled by the main thread (fallback).
 */
import { workerData } from 'node:worker_threads'
import { mdxToJs } from 'satteri'
import { transform } from 'esbuild'
import { satteriRemarkMetaPlugin } from './satteri-plugins/remark-meta-plugin'
import { satteriRehypeSlugPlugin } from './satteri-plugins/rehype-slug-plugin'
import { satteriRehypeTableWhitespacePlugin } from './satteri-plugins/rehype-table-whitespace-plugin'
import {
  wrapRemarkPlugin,
  wrapRemarkCodePlugin,
} from './satteri-plugins/remark-adapter'
import { wrapHastPlugin } from './satteri-plugins/rehype-adapter'
import {
  satteriRehypeCodeHighlightPlugin,
  type CodeHighlightConfig,
} from './satteri-plugins/rehype-shiki-plugin'
import { importFromPath, resolveProjectModule } from './module-resolution'
import type { MdastPluginDefinition, HastPluginDefinition } from 'satteri'

/**
 * A user plugin hook described so that this worker can rebuild it.
 *
 * Mirrors `WorkerHook` in `@bdocs/contracts`: a remark or rehype plugin is a
 * function, and a function cannot cross a worker boundary. Naming the module
 * and the export instead lets the worker obtain the same plugin.
 */
export interface WorkerHookDescriptor {
  module: string
  export: string
  options?: Record<string, unknown>
  kind?: 'transformer' | 'code'
  language?: string
  component?: string
}

const workerDataPayload =
  (workerData as
    | {
        codeHighlighting?: CodeHighlightConfig
        remarkHooks?: WorkerHookDescriptor[]
        rehypeHooks?: WorkerHookDescriptor[]
        projectRoot?: string
      }
    | undefined) ?? {}

const workerCodeHighlighting = workerDataPayload.codeHighlighting
const workerRemarkHooks = workerDataPayload.remarkHooks ?? []
const workerRehypeHooks = workerDataPayload.rehypeHooks ?? []
const workerProjectRoot = workerDataPayload.projectRoot

// Built-in plugins (created once per worker, reused for all compilations)
const DEFAULT_MDAST_PLUGINS = [satteriRemarkMetaPlugin()]
const DEFAULT_HAST_PLUGINS = [
  satteriRehypeSlugPlugin(),
  satteriRehypeTableWhitespacePlugin(),
  satteriRehypeCodeHighlightPlugin(workerCodeHighlighting),
]

/**
 * The user plugins this worker rebuilt for itself.
 *
 * Resolved once, at worker start: the hooks are the same for every page, and
 * importing the module is the expensive part.
 */
let userMdastPlugins: MdastPluginDefinition[] = []
let userHastPlugins: HastPluginDefinition[] = []

/**
 * Import the export a hook names.
 *
 * The export is returned as it is — a factory or a transformer. The adapters
 * call it with the options, so a hook behaves in the worker exactly as it
 * does on the main thread.
 */
async function importHook(hook: WorkerHookDescriptor): Promise<unknown> {
  try {
    const specifier = workerProjectRoot
      ? resolveProjectModule(workerProjectRoot, hook.module)
      : hook.module
    const mod = (await importFromPath(specifier)) as Record<string, unknown>
    const factory = mod[hook.export]
    if (typeof factory !== 'function') return undefined
    return factory
  } catch {
    return undefined
  }
}

/**
 * Rebuild a remark hook.
 *
 * A `code` hook transforms the code blocks of one language into a component.
 * The wrapper needs to know which language and which component, because that
 * is what the replacement node is built from.
 */
async function buildRemarkHook(
  hook: WorkerHookDescriptor,
): Promise<MdastPluginDefinition | undefined> {
  const exported = await importHook(hook)
  if (!exported) return undefined

  if (hook.kind === 'code' && hook.language && hook.component) {
    return (
      wrapRemarkCodePlugin(
        exported as Parameters<typeof wrapRemarkCodePlugin>[0],
        hook.options ?? {},
        hook.component,
        hook.language,
      ) ?? undefined
    )
  }

  // A transformer hook is a factory that takes the options and returns the
  // transformer. Calling it here keeps the worker and the main thread on the
  // same plugin.
  const factory = (exported as (options?: unknown) => unknown)(
    hook.options ?? {},
  )
  return (
    wrapRemarkPlugin(factory as Parameters<typeof wrapRemarkPlugin>[0]) ??
    undefined
  )
}

async function buildRehypeHook(
  hook: WorkerHookDescriptor,
): Promise<HastPluginDefinition | undefined> {
  const exported = await importHook(hook)
  if (!exported) return undefined
  const factory = (exported as (options?: unknown) => unknown)(
    hook.options ?? {},
  )
  return (
    wrapHastPlugin(factory as Parameters<typeof wrapHastPlugin>[0]) ?? undefined
  )
}

/**
 * The user plugins, resolved once.
 *
 * The resolution is shared as a promise rather than guarded by a flag: a
 * worker handles one job at a time, but the flag was set *before* the
 * resolution finished, so a job that arrived while the first was still
 * importing the module found the flag set and the plugin list empty. The
 * pages it compiled then came out without the plugin — measurably, 160 of 221
 * pages lost their code block titles.
 */
let userPluginsPromise: Promise<void> | null = null

function resolveUserPlugins(): Promise<void> {
  if (!userPluginsPromise) {
    userPluginsPromise = (async () => {
      userMdastPlugins = (
        await Promise.all(
          workerRemarkHooks.map((hook) => buildRemarkHook(hook)),
        )
      ).filter((plugin): plugin is MdastPluginDefinition => Boolean(plugin))
      userHastPlugins = (
        await Promise.all(
          workerRehypeHooks.map((hook) => buildRehypeHook(hook)),
        )
      ).filter((plugin): plugin is HastPluginDefinition => Boolean(plugin))
    })()
  }
  return userPluginsPromise
}

// Eagerly pre-warm Sätteri + the highlighter engine at worker instantiation.
// The source includes fenced blocks in every eager (common) language so the
// grammars load while the pool spins up instead of serially during the first
// real page compilations. `mdxToJs` is synchronous in the NAPI
// implementation, so use try/catch instead of Promise.catch() here. The
// compile path below intentionally uses `await`, which remains compatible
// with both sync and async implementations.
const PREWARM_SNIPPET = 'const boltdocsPrewarm = 1'
/**
 * The languages the worker compiles a snippet of, to load their grammars.
 *
 * These are the eager set of `@bdocs/grammars` — the languages a
 * documentation site uses most, and the ones whose compilation a worker
 * would otherwise do inside its first real job.
 *
 * `yaml` is here for a reason beyond its frequency: the Markdown grammar
 * highlights a leading `---` block as front matter, and it does so by
 * including the YAML grammar. The inclusion only resolves if that grammar
 * is loaded, and it otherwise loads by accident — when some other page
 * happens to use YAML first. A worker that always loads it produces the
 * same output whatever page it happens to compile first.
 */
const PREWARM_LANGS = [
  'ts',
  'js',
  'tsx',
  'bash',
  'json',
  'css',
  'html',
  'python',
  'go',
  'markdown',
  'yaml',
]
const PREWARM_SOURCE = [
  '# Prewarm',
  '',
  ...PREWARM_LANGS.map((lang) =>
    ['```' + lang, PREWARM_SNIPPET, '```', ''].join('\n'),
  ),
].join('\n')

try {
  mdxToJs(PREWARM_SOURCE, {
    jsxRuntime: 'automatic',
    jsxImportSource: 'react',
    outputFormat: 'program',
    mdastPlugins: [...DEFAULT_MDAST_PLUGINS],
    hastPlugins: [...DEFAULT_HAST_PLUGINS],
    features: { gfm: true, frontmatter: true },
  })
} catch {
  // Prewarming is best-effort; compilation reports real errors to the caller.
}

/**
 * Warm the highlighter for the languages this worker will actually use.
 *
 * The prewarm above compiles a snippet per eager language, but the highlight
 * plugin loads its grammars asynchronously and the compile above does not
 * wait for it. The first real job of a worker therefore paid for the grammar
 * compilation — measured at 1.1 s — and every worker paid it separately.
 *
 * Doing it here, before the first job, moves the cost into the pool's
 * startup, where the workers do it in parallel with each other instead of
 * one after the other.
 */
async function prewarmGrammars(): Promise<void> {
  try {
    const mod = (await import('boltdocs/node/highlight')) as {
      getCodeHighlighterAdapter: (config?: unknown) => Promise<{
        initialize: () => Promise<unknown>
        ensureLanguage?: (lang: string) => Promise<boolean>
      }>
    }
    const adapter = await mod.getCodeHighlighterAdapter(workerCodeHighlighting)
    await adapter.initialize()
    for (const lang of PREWARM_LANGS) {
      await adapter.ensureLanguage?.(lang)
    }
  } catch {
    // Best-effort: a page that needs the language loads it on demand.
  }
}

export default async function compileTask(msg: {
  sourceCode: string
  filePath: string
}) {
  const { sourceCode, filePath } = msg

  try {
    // The user plugins and the grammars are warmed before the first real
    // job, so the cost lands in the pool's startup rather than in whichever
    // page happens to arrive first.
    await resolveUserPlugins()
    await prewarmGrammars()

    const result = await mdxToJs(sourceCode, {
      jsxRuntime: 'automatic',
      jsxImportSource: 'react',
      outputFormat: 'program',
      mdastPlugins: [...DEFAULT_MDAST_PLUGINS, ...userMdastPlugins],
      hastPlugins: [...DEFAULT_HAST_PLUGINS, ...userHastPlugins],
      features: { gfm: true, frontmatter: true },
    })

    let compiledCode = result?.code ?? ''
    if (compiledCode.includes('<')) {
      try {
        // The asynchronous API, not the synchronous one. `transformSync` starts
        // a service per call and tears it down afterwards; `transform` keeps
        // one alive for the life of the worker. Measured on a compiled page:
        // 5.2 ms per call against 2.0 ms, and the difference is per page.
        const transformed = await transform(compiledCode, {
          loader: 'jsx',
          jsx: 'automatic',
          jsxImportSource: 'react',
        })
        if (transformed?.code) {
          compiledCode = transformed.code
        }
      } catch {}
    }

    return {
      compiledCode,
      filePath,
      success: true,
    }
  } catch (err) {
    return {
      compiledCode: '',
      filePath,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
