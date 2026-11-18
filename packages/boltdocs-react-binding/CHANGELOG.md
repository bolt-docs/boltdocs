# @bdocs/react-binding

## 1.1.0

### Minor Changes

- Extract the React binding out of the engine (SPEC §5/§6). The engine no longer
  imports `@vitejs/plugin-react`, ships `react-helmet-async` or `react-refresh`,
  or generates React-specific entry code. It resolves `uiBindingPackage` by name
  (default `@bdocs/react-binding`) and asks it for Vite plugins and for `createRoot`.
  The binding owns Fast Refresh, JSX/SSR/dedupe config, prewarm entries and the
  client root. Core footprint dropped slightly (104067 → 103943 gzip bytes).

### Patch Changes

- Updated dependencies [1413a37]
- Updated dependencies [7628363]
- Updated dependencies [4a2de60]
- Updated dependencies [d80c6e1]
- Updated dependencies [3ad10bb]
- Updated dependencies [94aebbc]
- Updated dependencies [5f7a09c]
  - @bdocs/runtime@1.1.0
  - @bdocs/ssg@0.6.0
