# @bdocs/ui-base

## 1.1.0

### Minor Changes

- Extract the reusable UI layer into `@bdocs/ui-base`. The composition wrappers,
  the assembled UI components (navbar, sidebar, TOC, search dialog, …), their
  hooks, utilities and native stylesheet now live in their own package.
  `@bdocs/theme-neutral` depends on it and re-exports the whole public surface,
  so existing `@bdocs/theme-neutral` and `@bdocs/theme-neutral/composition`
  imports keep working. This completes the §6 split of `ui-base` out of the theme.

### Patch Changes

- Updated dependencies [1413a37]
- Updated dependencies [7628363]
- Updated dependencies [4a2de60]
- Updated dependencies [3ad10bb]
- Updated dependencies [e1fe3cb]
- Updated dependencies
- Updated dependencies [fd11c2f]
- Updated dependencies [94aebbc]
  - @bdocs/runtime@1.1.0
  - @bdocs/primitives@1.1.0
