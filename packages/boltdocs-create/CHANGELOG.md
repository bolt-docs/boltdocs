# create-boltdocs

## 1.0.0

### Major Changes

- Replace `react-aria-components` with `@bdocs/primitives`.

### Minor Changes

- Make the core CSS-agnostic: remove Tailwind/Vite Tailwind coupling and CSS-framework assumptions from the engine and neutral theme, replace `cn` with framework-neutral `clsx` class joining (no Tailwind merge), ship the neutral theme as plain CSS only, and update scaffolding/templates to opt into Tailwind explicitly via `@bdocs/plugin-tailwindcss` when needed.

### Patch Changes

- Migrate the Zig parser and critical-CSS extractor to Zig 0.17 and ship much smaller binaries.

## 0.5.0

### Minor Changes

- Add a blog template and an icon library prompt that auto-generates `docs/icons.tsx` with named exports.

## 0.4.3

### Patch Changes

- Update scaffolded `package.json` — add `react-aria-components` as dependency (now a required peer of `boltdocs`) and remove `sharp` from `onlyBuiltDependencies` (core no longer depends on it).

## 0.4.2

### Patch Changes

- Fix: repared imports of components mdx
- fix: resolve SSG build and pnpm 10+ install failures

## 0.4.1

### Patch Changes

- Fix crash in `create-boltdocs` scaffolder caused by using non-existent `colors.orange` from `@bdocs/dui`. Replaced with `colorize()` using Cloudflare brand hex color.

## 0.4.0

### Minor Changes

- - **boltdocs (Minor)**:

## 0.3.2

### Patch Changes

- fix: solve various bugs including theme flashing, i18n sidebar disappearing/duplication, upgrade check reliability, CLI port/host support, and create-boltdocs project name argument support.

## 0.3.1

### Patch Changes

- fix: ReferenceError - magenta is not defined in create-boltdocs template prompt

## 0.3.0

### Minor Changes

- - **Directory structure update**: Updated templates and default structures to align with the new `.boltdocs/` subdirectory layout.

### Patch Changes

## 0.2.5

### Patch Changes

- Replace direct `picocolors` usage with `@bdocs/dui`.

## 0.2.4

### Patch Changes

- update create-boltdocs templates

## 0.2.3

### Patch Changes

- fix: added home page into of pages-external

## 0.2.2

### Patch Changes

- - **fix**: Updated theme colors

## 0.2.1

### Patch Changes

- feat: - types - updated package.json - updated file structure

## 0.2.0

### Minor Changes

- updated packages & support new folder-structure

## 0.1.0

### Minor Changes

- support external-page and updated packages and APIS
