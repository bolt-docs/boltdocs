---
'boltdocs': patch
---

Stop the plugin lifecycle from loading the build pipeline.

`PluginLifecycleManager` imported the `Pipeline` step runner from the
`node/pipeline` barrel, and that barrel re-exports `createBuildPipeline` — which
imports every build step, and with them the SSG package and its tooling. The
first route generation of a dev server, and the first plugin hook of a build,
paid for a module graph they never used.

The step runner now lives in its own module (`node/pipeline/pipeline.ts`) with
no dependencies beyond its own types, and the lifecycle imports it from there.
The barrel keeps the same public surface, so nothing outside the core changes.

Measured on the `routes:resolved` hook path, module init for the plugin
lifecycle dropped from 3248 ms to 852 ms, and the hook test file that timed
out on a loaded machine now runs in 716 ms.
