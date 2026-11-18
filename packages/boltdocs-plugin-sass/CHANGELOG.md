# @bdocs/plugin-sass

## 1.0.0

### Minor Changes

- 5f7a09c: Vite 8.3.5, and only Vite 8.3.

  The framework now builds on Vite 8.3.5 and requires it. The peer dependency
  range moved from `^8.1.0` to `^8.3.0`, so a site on Vite 8.1 or 8.2 has to
  update before it can install the new Boltdocs.

  Two version checks went away with it, because the versions they served no
  longer exist:
  - The build used to choose between `build.rolldownOptions` and
    `build.rollupOptions` depending on the installed Vite. Vite 8 is Rolldown,
    and the two option names are not interchangeable — the options moved with
    the bundler, not with the options — so the check only ever chose the wrong
    one for a Vite it did not support anyway.
  - The build used to look for the manifests in the output root on Vite before
    5, which had no `.vite` directory. There is no such Vite left to support.

  The output does not change: the documentation site's 260 pages are byte for
  byte identical across the two versions, and the client bundle grows by four
  bytes.

  `@types/node` moved from 22.0.0 to 22.12.0 across the workspace, which is
  what Vite 8.3 asks for, and an override pins it so the whole tree resolves
  one copy.

### Patch Changes

- Fixed a critical compatibility bug: the engine read the **monorepo root**
  package version (1.11.0) instead of its own (3.4.1) when checking plugin
  ranges. That silently failed every plugin validation, and the swallowed error
  dropped all extra Vite plugins — including Tailwind — so docs utility classes
  were never generated. Version resolution now walks up by package name, and the
  validation error is logged instead of swallowed.

  Enforce SPEC §2.3: `boltdocs audit` now runs as a preflight for both `build`
  and `dev`, and fails the command on unresolved plugins, scan errors, truncated
  scans or high-risk findings. Every shipped plugin declares `version` and
  `boltdocsVersion`, and the validator requires them. Plugin identity can name a
  different package via `packageName` (used by git-meta's two exports).

  The scanner now treats spawning/forking a fixed local process as a warning and
  reserves `high` for shell execution; Mermaid no longer auto-installs Chromium
  with `npx` behind the user's back. The metadata version check compares the
  engine version against the plugin's supported range instead of the plugin's own
  version. CI runs `boltdocs audit` after building.

- Updated dependencies [1413a37]
- Updated dependencies [4fb6ed1]
- Updated dependencies [7628363]
- Updated dependencies [4a2de60]
- Updated dependencies [f7464bf]
- Updated dependencies
- Updated dependencies [4fb6ed1]
- Updated dependencies [223e891]
- Updated dependencies [4fb6ed1]
- Updated dependencies [d80c6e1]
- Updated dependencies [d1e7f76]
- Updated dependencies [cdd636a]
- Updated dependencies [7a26134]
- Updated dependencies [a19cc4a]
- Updated dependencies [be963fa]
- Updated dependencies
- Updated dependencies [3007d0b]
- Updated dependencies [9a4c13b]
- Updated dependencies
- Updated dependencies [fd11c2f]
- Updated dependencies [4fb6ed1]
- Updated dependencies [4fb6ed1]
- Updated dependencies [c2e2b6b]
- Updated dependencies [e6837b3]
- Updated dependencies
- Updated dependencies [4fb6ed1]
- Updated dependencies [40a4c01]
- Updated dependencies [80b8bba]
- Updated dependencies [94aebbc]
- Updated dependencies [40a4c01]
- Updated dependencies [53ba421]
- Updated dependencies [84e874d]
- Updated dependencies [cf79338]
- Updated dependencies [32d05b3]
- Updated dependencies [727f796]
- Updated dependencies [cc053a8]
- Updated dependencies [597897b]
- Updated dependencies [5f7a09c]
  - boltdocs@4.0.0

## 0.0.3

### Patch Changes

- [`1d62dac`](https://github.com/bolt-docs/boltdocs/commit/1d62dac2bc237a919df6a89d5ebf7c94a94f742b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Maintenance fixes shipped alongside the Boltdocs 3.4.0 release line.

- Updated dependencies [[`f0a7586`](https://github.com/bolt-docs/boltdocs/commit/f0a75864646c3752c4ea258e2890ecc31717aa9f), [`f6235ac`](https://github.com/bolt-docs/boltdocs/commit/f6235ac3559a7bc0f05ab053b1b630e01d978986), [`05d8ddc`](https://github.com/bolt-docs/boltdocs/commit/05d8ddc432f804b0fdc8f5c5db4ac8090c92a2d8), [`d7f19fb`](https://github.com/bolt-docs/boltdocs/commit/d7f19fb48d280a760acf75d26f2bfa728e5e2a60), [`c38766b`](https://github.com/bolt-docs/boltdocs/commit/c38766b3fb1fdd1e45578bd3cb3d31c699cf4a30), [`e203fcb`](https://github.com/bolt-docs/boltdocs/commit/e203fcbce495f96f66594e33ea21c2e430e9fde1), [`24e3607`](https://github.com/bolt-docs/boltdocs/commit/24e36071381699e8112123935243e82e641c6728), [`147d39f`](https://github.com/bolt-docs/boltdocs/commit/147d39fb2e23c575b92cfa281869fffa50221a50), [`7841b09`](https://github.com/bolt-docs/boltdocs/commit/7841b0979f4cd60d70829bd9d6c5feb332dc8e12), [`e7b213c`](https://github.com/bolt-docs/boltdocs/commit/e7b213cfd4a0c3b6232a79e8861e2215f0b4bd09), [`1d62dac`](https://github.com/bolt-docs/boltdocs/commit/1d62dac2bc237a919df6a89d5ebf7c94a94f742b)]:
  - boltdocs@3.4.0

## 0.0.2

### Patch Changes

- [`f90f525`](https://github.com/bolt-docs/boltdocs/commit/f90f525cf9d8f9d4191304e81edf711591eb97c6) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Improve the CSS plugin integrations with Vite 8: Sass compiler options are forwarded to both SCSS and indented Sass, while UnoCSS automatically scans Boltdocs Markdown/MDX sources and supports its full Vite mode configuration. Their tsdown configs also use the current `deps.neverBundle` API without deprecated `external` options.

- Updated dependencies [[`4e8d80e`](https://github.com/bolt-docs/boltdocs/commit/4e8d80e5157ab637dde917f42d30878ab2a0347d), [`682d0c1`](https://github.com/bolt-docs/boltdocs/commit/682d0c1252097491faf3752e3337ea681271a3e0), [`682d0c1`](https://github.com/bolt-docs/boltdocs/commit/682d0c1252097491faf3752e3337ea681271a3e0), [`682d0c1`](https://github.com/bolt-docs/boltdocs/commit/682d0c1252097491faf3752e3337ea681271a3e0)]:
  - boltdocs@3.3.6
