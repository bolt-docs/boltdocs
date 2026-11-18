# create-boltdocs

## 1.0.0

### Major Changes

- fd11c2f: Replace `react-aria-components` with `@bdocs/primitives`.

  The client primitives now come from a package in this repository instead of from
  `react-aria-components`. That tree was 23.4 MB across 113 packages and was a
  **required peer** of `boltdocs`, so every site paid for it whether or not it used
  a single interactive component.

  ### Measured effect

  Per-visit JS on the documentation site, measured on the same machine against a
  build of `4.0` at `fc13afeb`:

  |                         | eager JS, raw          | eager JS, gzip        |
  | ----------------------- | ---------------------- | --------------------- |
  | `react-aria-components` | 1014.3 kB              | 271.9 kB              |
  | `@bdocs/primitives`     | 853.8 kB               | 221.3 kB              |
  | **delta**               | **−160.5 kB (−15.8%)** | **−50.6 kB (−18.6%)** |

  The application chunk alone goes from 736.5 kB to 576.0 kB. Install closure
  drops by the full size of the react-aria tree. Rendered output is unchanged: of
  the 259 pages in the documentation build, every one is byte-identical once
  react-aria's internal bookkeeping (`data-rac`, `data-react-aria-pressable`,
  `react-aria-*` ids, a redundant `tabindex="0"` on buttons, and the order in which
  JSX attributes are serialised) is normalised away. The single structural
  difference on each page is the `relative inline-block` wrapper around a menu
  trigger, which CSS-anchored positioning needs in place of a positioning engine.

  ### What is not implemented
  - **No viewport collision or flipping.** Popovers and menus are positioned with
    CSS relative to their trigger. Boltdocs anchors them to navbar and sidebar
    items where the surrounding layout already decides the side, so a full
    collision solver would be cost without a use. A popover near a viewport edge
    will overflow rather than flip.
  - **`SSRProvider` is gone, not replaced.** It existed because react-aria derives
    element ids from a module-level counter that starts at a different value on
    the server and in the browser. `@bdocs/primitives` uses React's `useId`, which
    agrees across the boundary by construction, so there is nothing to reconcile.

  ### Accessibility changes worth knowing

  These are deliberate, and in two cases they are corrections rather than parity:
  - A selectable `Menu` renders `menuitemradio` for one-of-many and
    `menuitemcheckbox` for many-of-many, with `aria-checked` only when the menu can
    select. A plain `menuitem` carrying `aria-checked` is not a combination the
    authoring practices define.
  - `MenuTrigger` clones a trigger that is already a control and wraps anything
    else in a real `button`. A `<span>` handed in as a trigger would otherwise
    receive `aria-expanded` and the event handlers while remaining unreachable by
    keyboard and unannounced by a screen reader.
  - A trigger now carries `aria-controls` pointing at the popup. react-aria
    omitted it.
  - `Separator` no longer ships a background colour. It was `bg-border`, which
    competed with the caller's own background, and which of two same-specificity
    background utilities wins is decided by their order in the generated
    stylesheet rather than the order they are written in.

  ### Migration

  `react-aria-components` is no longer a peer dependency, a dependency, or a dev
  dependency of `boltdocs`, and is no longer scaffolded by `create-boltdocs`. There
  is nothing to uninstall from a host app's `package.json` other than the entry
  itself. Theme components that were written against the react-aria props
  (`placement`, `offset`, `crossOffset`, `onPress` on a menu item, `isSelected` and
  `onSelectionChange` on a menu) need the `@bdocs/primitives` equivalents: menus are
  positioned with `className`, and `MenuItem` reports activation through
  `onAction`.

  ### Other fixes in this change
  - `packages/boltdocs-engine` type-checks clean. The 46 errors it carried were all
    `TS7016` implicit-`any` imports of the vendored Shiki grammars and themes,
    introduced when those assets were vendored; each vendored `.mjs` now has a
    sibling `.d.mts`.

### Minor Changes

- f7464bf: Make the core CSS-agnostic: remove Tailwind/Vite Tailwind coupling and CSS-framework assumptions from the engine and neutral theme, replace `cn` with framework-neutral `clsx` class joining (no Tailwind merge), ship the neutral theme as plain CSS only, and update scaffolding/templates to opt into Tailwind explicitly via `@bdocs/plugin-tailwindcss` when needed.

### Patch Changes

- Migrate the Zig parser and critical-CSS extractor to Zig 0.17 and ship much smaller binaries.

  `@bdocs/parser` now builds on Zig 0.17 (`.debug`, `@splat`, `@backingInt`, `std.Io` APIs), and its native, WASM and N-API artifacts are stripped and built with `ReleaseSmall`:

  | Artifact             | Before |  After |
  | -------------------- | -----: | -----: |
  | N-API shared library | 4.5 MB | 218 KB |
  | Native CLI           | 358 KB | 227 KB |
  | WASM fallback        | 195 KB | 126 KB |

  `@bdocs/zig-critters` (private) moves to Zig 0.17 as well. Its WASM target is now `wasm32-freestanding` and links with Zig's own bundled linker — no external `wasm-ld` is required. The committed `.wasm` shrinks from 243,887 to 34,199 bytes (−86%), and the native benchmark binary from 4.6 MB to 205 KB.

  Installation is also fixed end to end: `postinstall` now downloads the CLI **and** the N-API library into the package-local `.cache` used by the runtime (the previous path did not match), the CLI exposes `--version` so downloads can be verified, the release workflow pins Zig 0.17.0 and publishes the WASM fallback, and `@bdocs/parser` / `koffi` are allowlisted in `onlyBuiltDependencies` so lifecycle scripts actually run on pnpm 10.

  Scaffolded projects also work on pnpm 12, which no longer reads `pnpm.onlyBuiltDependencies` from `package.json`: the templates now ship a `pnpm-workspace.yaml` with the equivalent `allowBuilds` map (and keep the legacy field for pnpm 10/11). The troubleshooting guide documents both forms.

  All Zig, TypeScript and JavaScript tests pass (13 N-API/WASM, 9 critters WASM).

## 0.5.0

### Minor Changes

- [`9c5251c`](https://github.com/bolt-docs/boltdocs/commit/9c5251c4fba6efee8d9d1920495be9c731bab8b2) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Add a blog template and an icon library prompt that auto-generates `docs/icons.tsx` with named exports.

## 0.4.3

### Patch Changes

- [`ab2ea31`](https://github.com/bolt-docs/boltdocs/commit/ab2ea31230eed4828dc2bdcd88a39e17344387cc) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Update scaffolded `package.json` — add `react-aria-components` as dependency (now a required peer of `boltdocs`) and remove `sharp` from `onlyBuiltDependencies` (core no longer depends on it).

## 0.4.2

### Patch Changes

- [`0cd980e`](https://github.com/bolt-docs/boltdocs/commit/0cd980e1731bf9ced14808bf61c66f9084305db8) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix: repared imports of components mdx

- [`e5225e5`](https://github.com/bolt-docs/boltdocs/commit/e5225e5678b8e046dadb745010becf9bf652973e) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: resolve SSG build and pnpm 10+ install failures
  - Remove `react-fast-compare` from SSR external list to fix `ERR_MODULE_NOT_FOUND` during SSG builds (it's a CJS-only transitive dep of `react-helmet-async` that can't be resolved from pnpm's strict node_modules)
  - Add `pnpm.onlyBuiltDependencies` to `create-boltdocs` templates (base + i18n) so `pnpm install` works out of the box with pnpm 10+ without requiring manual `pnpm approve-builds`

## 0.4.1

### Patch Changes

- [`cb0c2c4`](https://github.com/bolt-docs/boltdocs/commit/cb0c2c437ecac0432ee06632f68ba3076960e43c) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix crash in `create-boltdocs` scaffolder caused by using non-existent `colors.orange` from `@bdocs/dui`. Replaced with `colorize()` using Cloudflare brand hex color.

## 0.4.0

### Minor Changes

- [`b819f24`](https://github.com/bolt-docs/boltdocs/commit/b819f240fa420d873db0e0f3ff0443e6ff1a3e7b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **boltdocs (Minor)**:
  - Extracted the `@bdocs/dui` toolkit as a standalone terminal UI package.
  - Added native feedback integrations supporting Vercel, Netlify, and AWS Lambda adapters.
  - Supported the new `transformSource` plugin lifecycle hook for custom Remark/Rehype preprocessing.
  - Added new CLI dev server flags: `--port`, `--host`, and `--force`.
  - Implemented Phase 0 performance optimizations: deduplicated dev config resolution, instant dev server prewarming, pre-loaded Shiki highlighter during plugin configuration, and added debounced `TransformCache` index persistence.
  - Fixed collection routes provider wrapping at the global shell level, corrected `cover` frontmatter fallbacks, and updated outdated collections hook documentation examples.
  - **create-boltdocs (Minor)**:
    - Completed a full rewrite of the scaffolding CLI templates using the `@bdocs/dui` terminal package.
    - Added integration setup helpers and automated deployment adapters.
  - **@bdocs/plugin-image-optimizer (Minor)**:
    - Added the `@bdocs/plugin-image-optimizer` package to automatically optimize and cache WebP/SVG/PNG assets during static build compilation.
  - **@bdocs/plugin-mermaid (Patch)**:
    - Performance optimizations to prevent Mermaid scripts from blocking client rendering.

## 0.3.2

### Patch Changes

- [`5fb0685`](https://github.com/bolt-docs/boltdocs/commit/5fb06852bfbd94e84cd502f5e874acd1e5f6d947) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: solve various bugs including theme flashing, i18n sidebar disappearing/duplication, upgrade check reliability, CLI port/host support, and create-boltdocs project name argument support.

  Specifically for i18n, sidebar, and fallback route routing:
  - Refactored `useSidebar` to perform hierarchical tree calculations cleanly without mutations.
  - Filtered out fallback redirect routes in `useSidebar` via the `fallback` route property to eliminate duplicate entries in the sidebar.
  - Preserved `filePath` properties on index/container route nodes so that client-side language switching and active link highlighting operate correctly.

## 0.3.1

### Patch Changes

- [`ad137a6`](https://github.com/bolt-docs/boltdocs/commit/ad137a62d377e2c8ed403f56965315e1b7e0d1dc) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: ReferenceError - magenta is not defined in create-boltdocs template prompt

## 0.3.0

### Minor Changes

- [`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **Directory structure update**: Updated templates and default structures to align with the new `.boltdocs/` subdirectory layout.

### Patch Changes

- Updated dependencies [[`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32)]:
  - @bdocs/dui@0.1.2

## 0.2.5

### Patch Changes

- [`36a7d09`](https://github.com/bolt-docs/boltdocs/commit/36a7d093a0304620ddaed6c2ed8616edbaa62987) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Replace direct `picocolors` usage with `@bdocs/dui`. All `console.log/error` calls migrated to `dui.logger.*` (info/warn/error/success). Colors now use `dui.colors` instead of direct picocolors. Removes `picocolors` from direct dependencies (transitive via dui).

- Updated dependencies [[`a780571`](https://github.com/bolt-docs/boltdocs/commit/a78057165a087b36793ceced3bf5799631b9261a), [`375264f`](https://github.com/bolt-docs/boltdocs/commit/375264fb24912fa51da39ccb9fbc78b3a4962b72), [`b736267`](https://github.com/bolt-docs/boltdocs/commit/b736267f8764ab92f9b4fb3ee1f9f0b0bd07e6e0), [`f478f53`](https://github.com/bolt-docs/boltdocs/commit/f478f539a6da7a32c9ecef44fda0013b7b478133), [`f0be317`](https://github.com/bolt-docs/boltdocs/commit/f0be317824d34e6827284a342af946de53396c18)]:
  - @bdocs/dui@0.1.1

## 0.2.4

### Patch Changes

- [`2ca7562`](https://github.com/bolt-docs/boltdocs/commit/2ca7562b7f6b95955426afdbf15b94b82b5d3e60) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - update create-boltdocs templates

## 0.2.3

### Patch Changes

- [`3410ffa`](https://github.com/bolt-docs/boltdocs/commit/3410ffadcb03ec61d41429c9c36e2104123a6568) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: added home page into of pages-external

## 0.2.2

### Patch Changes

- [`b04fce4`](https://github.com/bolt-docs/boltdocs/commit/b04fce42678230b607adcde349e8bb95f6dca1f3) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **fix**: Updated theme colors
  - **fix**: Updated templates

## 0.2.1

### Patch Changes

- [`b1eb43c`](https://github.com/bolt-docs/boltdocs/commit/b1eb43c8ece876f5e0e01b0c8d2db5a7ae4c4f7a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: - types - updated package.json - updated file structure

## 0.2.0

### Minor Changes

- [`6706448`](https://github.com/bolt-docs/boltdocs/commit/6706448b285db9de0f5aad3025d8f16a2c783532) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - updated packages & support new folder-structure

## 0.1.0

### Minor Changes

- [`1395179`](https://github.com/bolt-docs/boltdocs/commit/1395179b25ec58401b809745eb1bdc998f3dffab) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - support external-page and updated packages and APIS
