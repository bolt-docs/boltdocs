# @bdocs/contracts

## 0.2.0

### Minor Changes

- Add `@bdocs/runtime`: the browser half of Boltdocs, split out of the core.
- Make the highlighter pipeline genuinely engine-agnostic.
- Finish search: the `search:index` hook works, and two real engines ship.
- The production build stops loading a browser it never renders in.
- The engine depends on nothing but the contracts.
- A user plugin's MDX hook can be rebuilt in a build worker, so a site with one keeps its parallel MDX compile.

### Patch Changes

- Add first-party git metadata plugins and wire the documented `routes:resolved` hook.
- The type checker is clean, and the highlighting configuration has one type.

## 0.1.0

### Minor Changes

- Boltdocs 3.4.0 — architecture contracts and incremental build foundation.
