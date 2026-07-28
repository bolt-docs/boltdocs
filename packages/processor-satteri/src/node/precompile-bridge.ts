/**
 * P2-21: Precompile bridge — module-level shared state that allows the
 * pipeline (or `ssgBuild()`) to signal to the Sätteri Vite plugin that
 * MDX precompilation should start ASAP, BEFORE `buildStart()` blocks.
 *
 * Usage:
 *   1. Pipeline signals early precompile:  `signalEarlyPrecompile()`
 *   2. Sätteri plugin's configResolved: checks `wasEarlyPrecompileSignaled()`
 *      and if true, starts precompile immediately (not deferred).
 *   3. buildStart() fast-path: if pipeline provided a promise, await it.
 */

let _precompilePromise: Promise<void> | null = null
let _precompileStarted = false
let _earlySignal = false

/**
 * Signal that precompile should start as early as possible.
 * Called by ssgBuild() before resolveConfig() to set the flag.
 * The Sätteri plugin's configResolved() picks this up and starts
 * precompile immediately.
 */
export function signalEarlyPrecompile(): void {
  _earlySignal = true
}

/**
 * Whether early precompile was signaled.
 * Checked by configResolved to start precompile ASAP.
 */
export function wasEarlyPrecompileSignaled(): boolean {
  return _earlySignal
}

/**
 * Store an externally-started precompile promise.
 * Called by the pipeline to kick off MDX precompilation early.
 * When set, configResolved() skips starting a duplicate precompile,
 * and buildStart() awaits this promise instead.
 */
export function setPrecompilePromise(p: Promise<void>): void {
  _precompilePromise = p
  _precompileStarted = true
}

/**
 * Retrieve the externally-started precompile promise, if any.
 * Called by the Sätteri plugin's buildStart() — if non-null, await it
 * instead of starting a new precompile.
 */
export function getPrecompilePromise(): Promise<void> | null {
  return _precompilePromise
}

/**
 * Whether external precompile has been triggered.
 * Checked by configResolved to avoid starting a duplicate precompile.
 */
export function isPrecompileStarted(): boolean {
  return _precompileStarted
}

/**
 * Clear the bridge state (e.g. between builds in dev mode).
 */
export function resetPrecompileBridge(): void {
  _precompilePromise = null
  _precompileStarted = false
  _earlySignal = false
}
