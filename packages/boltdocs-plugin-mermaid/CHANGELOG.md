# @bdocs/plugin-mermaid

## 0.6.0

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

- ffb5e55: A user plugin's MDX hook can be rebuilt in a build worker, so a site with one keeps its parallel MDX compile.

  A remark or rehype plugin is a function, and a function cannot cross a worker
  boundary. A site with such a plugin therefore compiled its MDX on the main
  thread, one page at a time, while the rest of the machine waited. On the
  documentation site — 234 pages, with the Mermaid plugin transforming code
  blocks — that was 6.4 s of the build on one core.

  A plugin can now declare the same hook for a worker:

  ```ts
  export default function mermaidPlugin(options: MermaidPluginOptions = {}) {
    return {
      name: "boltdocs-plugin-mermaid",
      remarkPlugins: [[remarkMermaid, remarkOptions]],
      workerHooks: {
        remark: [
          {
            module: "@bdocs/plugin-mermaid",
            export: "remarkMermaid",
            options: remarkOptions,
            kind: "code",
            language: "mermaid",
            component: "Mermaid",
          },
        ],
      },
    };
  }
  ```

  The worker imports the module from the project — the way the site's own code
  resolves it — and calls the export to obtain the same plugin. The compiled
  pages are byte for byte identical to the ones the main thread compiles: the
  same 253 pages, compared file by file.

  The pool is used only when every user plugin that has an in-process hook also
  declares a worker hook. A plugin that does not is left to the main thread,
  because a worker that could not reproduce it would compile pages differently
  from the main thread, and the output would depend on which worker compiled
  which page.

  `options` crosses the boundary by structured clone, so it holds data rather
  than functions. A plugin that needs a function at runtime keeps its
  in-process hook and does not declare a worker hook.

  The pool is also smaller than it was: each worker loads the site's grammars
  for itself, so past four workers the duplicated warm-up costs more than the
  parallelism buys. Measured on the documentation site, four workers compile the
  234 pages in 5.4 s and eight in 8.4 s, while a single thread takes 6.4 s.

  |                | Before | After      |
  | -------------- | ------ | ---------- |
  | MDX precompile | 6.4 s  | **5.4 s**  |
  | Cold build     | 20.8 s | **19.7 s** |

### Patch Changes

- 4a2de60: The engine no longer ships the UI layer.

  Until 4.0 the `boltdocs` package carried the whole client stack: the layout,
  the components, the contexts, the router and the MDX components. A site got
  all of it by installing the engine, and reached it through `boltdocs/client`,
  `boltdocs/primitives` and `boltdocs/mdx`.

  In 4.0 the engine is the engine.

  ### What moved
  - The client code — the route builder, the shell, the MDX page, the collection
    routes — is now in `@bdocs/theme-neutral`. It renders the theme's
    components, so the engine could not keep it without depending on a theme.
  - `boltdocs` no longer exports `./client`, `./client/router`, `./primitives` or
    `./mdx`. It publishes the engine: the CLI, the config, the route generation,
    the plugin lifecycle, the SSG bridge (`./ssg`) and the engine stylesheet
    (`./theme/reset.css`).
  - The theme is resolved from the project, not from the engine. `themePackage`
    in the configuration names it (default `@bdocs/theme-neutral`), and the
    engine imports the route surface from it. A second theme is a second
    package, not a fork of the engine.

  ### What a site has to do

  ```bash
  pnpm add @bdocs/theme-neutral
  npx boltdocs migrate --apply
  ```

  The command splits a `boltdocs/client` import by name: every symbol goes to
  the package that exports it — components, layout and MDX components to
  `@bdocs/theme-neutral`, the router and the contexts to `@bdocs/runtime`. It
  rewrites the import examples in Markdown as well, and it adds the theme to
  the manifest.

  | 3.x                                           | 4.0                                |
  | --------------------------------------------- | ---------------------------------- |
  | `boltdocs/client` (components, layout, hooks) | `@bdocs/theme-neutral`             |
  | `boltdocs/client` (router, contexts)          | `@bdocs/runtime`                   |
  | `boltdocs/primitives`                         | `@bdocs/theme-neutral/composition` |
  | `boltdocs/mdx`                                | `@bdocs/theme-neutral`             |
  | `boltdocs/client/router`                      | `@bdocs/runtime/router`            |

  ### How the two halves still meet

  The generated per-site artifacts — the icon registry, the page-source fetcher,
  the search index, the site's `layout.tsx`, the plugin slots and the site's own
  MDX components — reach the theme through the runtime's site bridge, which the
  engine fills from a generated `virtual:boltdocs-site-bridge` module. The
  theme still mentions no virtual module, which is what lets it be installed on
  its own.

  The official plugins were moved the same way: a plugin's client code imports
  `@bdocs/runtime` for the contexts and `@bdocs/primitives` for the style-neutral
  helpers, so a plugin works with whatever theme the site uses.

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
- Updated dependencies [7628363]
- Updated dependencies [4a2de60]
- Updated dependencies [3ad10bb]
- Updated dependencies [e1fe3cb]
- Updated dependencies
- Updated dependencies [fd11c2f]
- Updated dependencies [94aebbc]
  - @bdocs/runtime@1.1.0
  - @bdocs/primitives@1.1.0

## 0.5.0

### Minor Changes

- [`9c5251c`](https://github.com/bolt-docs/boltdocs/commit/9c5251c4fba6efee8d9d1920495be9c731bab8b2) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Pre-render Mermaid diagrams in dev mode and refresh package metadata and build configs.

## 0.4.0

### Minor Changes

- [`64fe83a`](https://github.com/bolt-docs/boltdocs/commit/64fe83a2fc1b241f39ac7032bb38c7439041508c) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix mermaid pages having extra scroll space at the bottom
  - Fix body scroll bug: changed `min-height: 100%` to `height: 100%; overflow: hidden` on html/body in reset.css to prevent the browser scrollbar from appearing on all pages
  - Mermaid SVG cleaning now uses DOMParser to only strip sizing attributes from the root `<svg>` element, preserving inner element styles (transforms, font-size) that mermaid uses for node positioning
  - Added `not-prose` class to mermaid wrapper to prevent Tailwind typography plugin from adding margins to the SVG
  - Added `margin: 0 !important` to mermaid SVG CSS as additional safety
  - Added `overflow: hidden` to the root SVG element via cleanSvg
  - Moved `<style>` tag inside the mermaid container div to avoid prose layout interference

## 0.3.1

### Patch Changes

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

## 0.3.0

### Minor Changes

- [`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **Dynamic lazy loading**: Refactored the core library import to load Mermaid dynamically only when a page contains diagrams, optimizing the client bundle size.
  - **Configuration serialization fix**: Fixed theme configurations not being correctly parsed and rendered on client components, and improved the initial loading placeholder.

### Patch Changes

- Updated dependencies [[`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32)]:
  - @bdocs/dui@0.1.2

## 0.2.2

### Patch Changes

- [`9936474`](https://github.com/bolt-docs/boltdocs/commit/9936474d386795cc953574929c71cf8b448a7f83) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Replace node-side `console.warn` with `warn()` from `@bdocs/dui`. Client-side error logging in `Mermaid.tsx` left unchanged (browser context, dui is node-only).

- Updated dependencies [[`a780571`](https://github.com/bolt-docs/boltdocs/commit/a78057165a087b36793ceced3bf5799631b9261a), [`375264f`](https://github.com/bolt-docs/boltdocs/commit/375264fb24912fa51da39ccb9fbc78b3a4962b72), [`b736267`](https://github.com/bolt-docs/boltdocs/commit/b736267f8764ab92f9b4fb3ee1f9f0b0bd07e6e0), [`f478f53`](https://github.com/bolt-docs/boltdocs/commit/f478f539a6da7a32c9ecef44fda0013b7b478133), [`f0be317`](https://github.com/bolt-docs/boltdocs/commit/f0be317824d34e6827284a342af946de53396c18)]:
  - @bdocs/dui@0.1.1

## 0.2.1

### Patch Changes

- [`b04fce4`](https://github.com/bolt-docs/boltdocs/commit/b04fce42678230b607adcde349e8bb95f6dca1f3) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **fix**: Updated variables-css

## 0.2.0

### Minor Changes

- [`6a6d829`](https://github.com/bolt-docs/boltdocs/commit/6a6d82941328c1f2c016781d8d0f004d3a890237) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Support theme dark/light
  Support error rendering

## 0.1.1

### Patch Changes

- [`516b92e`](https://github.com/bolt-docs/boltdocs/commit/516b92e98adf93828c4429e464c8baaacf8fcfec) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: reduce space packages

## 0.1.0

### Minor Changes

- [`fc08cc4`](https://github.com/bolt-docs/boltdocs/commit/fc08cc42a759a2e771fcdf5ab1f8d76ac5108245) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - support new API the Boltdocs plugins

### Patch Changes

- [`f54fc62`](https://github.com/bolt-docs/boltdocs/commit/f54fc62982411e893beeccb2ebcb20d7a4925bdd) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - added types boltdocs

## 0.0.2

### Patch Changes

- [`0ee1f85`](https://github.com/bolt-docs/boltdocs/commit/0ee1f8525500ca6b6dc1eb78260fc257b3698fd4) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: updated name plugins and support error
