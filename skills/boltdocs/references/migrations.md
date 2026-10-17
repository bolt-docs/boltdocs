# Upgrading & Migration

How to move a Boltdocs project across versions. Boltdocs is semver-minor friendly — most upgrades are drop-in — but install-time peer changes and structural changes still need recipes. Start with the table, then read the section for the version you are crossing.

> The full narrative version of the 3.2 upgrade lives in the docs site at `/docs/guides/operations/upgrading-3-2`; the 4.x plan lives on the roadmap page (`/roadmap`).

## Version compatibility at a glance

| Crossing | Code changes needed | Effort |
| --- | --- | --- |
| 2.x → 3.0 | React 19, Vite 8, Tailwind v4 line — see the 3.0 release notes | Medium |
| 3.0 → 3.1 | Drop-in | None |
| 3.1 → 3.2 | Declare `react-aria-components`; plugin authors update icon imports | Low |
| 3.2 → 3.3 | Drop-in (benefits are automatic) | None |
| 3.3 → 3.4 | Drop-in (`@bdocs/contracts` is re-exported by `boltdocs`) | None |
| 3.x → 4.0 | Architecture migration — read the roadmap before adopting 4.x-only APIs | Plan ahead |

## Upgrading to 3.2.0

3.2.0 is **documented semver-minor** but touches `node_modules` at install time. The headline fixes the peer warning; the rest are conditional.

### The minimal change (95% of projects)

`react-aria-components` stopped being a transitive dependency. Declare it yourself:

```jsonc title="package.json"
{
  "dependencies": {
    "boltdocs": "^3.2.0",
    "react-aria-components": "^1.16.0"
  }
}
```

```bash
pnpm install
```

No code or config changes. The peer warning clears.

### If you use `@bdocs/plugin-image-optimizer`

`sharp` and `svgo` are optional peers — install behavior is unchanged. If you don't have them yet:

```sh
pnpm add @bdocs/ssg @bdocs/plugin-image-optimizer sharp@^0.34.5 svgo@^4.0.1
```

Projects that don't use the optimizer simply don't get those packages.

### If you author a plugin

The internal icon module path changed:

```ts
// ❌ Before 3.2.0 — gone
import { Github, Cs } from '../icons-dev'

// ✅ After 3.2.0 — social/nav icons moved to the framework's internal
//    `icons-prod` module. Plugin code should not import internals: render
//    your own SVG, or use an icon from `lucide-react` (a core dependency).
// Language icons were removed from the public API entirely. Language code
// blocks show the filename text; read `useCodeBlock().effectiveTitle` if you
// want to draw your own icon next to it.
```

The official upgrade guide (`/docs/guides/operations/upgrading-3-2`) documents the exact path for each version.

### Version-locked lockfiles

If your `pnpm-lock.yaml` is from 3.1.x, run `pnpm install` once after bumping `boltdocs`. `--frozen-lockfile` will complain on that first run only — expected, the lockfile needs the rewrite.

### CI / strict-peer setups

Husky + lint-staged, Renovate/Dependabot, and `--strict-peer-dependencies` monorepos may fail the first install. Scope the fix to **this one peer** (pick either `.npmrc` **or** `.pnpmrc`, not both):

```ini
# .npmrc
public-hoist-pattern[]=*react-aria-components*
```

```ini
# .pnpmrc
public-hoist-pattern=*react-aria-components*
peerDependencyRules.allowedVersions.react-aria-components=^1.16.0
```

**Don't** use `legacy-peer-deps=true` or `auto-install-peers=false` — they silence every peer warning and hide real breakages.

## Upgrading to 3.3.x

Drop-in. The win is automatic and mostly invisible:

- KaTeX is baked at build time (the math plugin emits pre-rendered `html`), so the ~250 KB math runtime leaves the entry bundle.
- FlexSearch is imported on demand when the search dialog opens.
- `pages-external` pages can use lazy `loader`s instead of static imports.
- A broad accessibility pass (tabs, OnThisPage, navbar, search labels, landmarks).
- Vite toolchain bumped to 8.1.

If you use the Shiki highlighter you can now nudge theme token colors for contrast:

```ts
theme: {
  codeHighlighting: {
    engine: 'shiki',
    theme: 'github-dark',
    options: { colorReplacements: { '#6A737D': '#8b949e' } },
  },
}
```

## Upgrading to 3.4.0

Drop-in, **no code changes**. 3.4.0 publishes the new **`@bdocs/contracts`** package and `boltdocs` re-exports it, so every 3.x public import keeps working.

- **`@bdocs/contracts`** is the framework-neutral contract layer (routes, plugin definitions, lifecycle hooks, highlighting, search documents, configuration). Import from it only if you want to depend on the contracts without pulling `boltdocs`.
- **Content-addressed SSG page cache** — editing one page re-renders that page, not the site.
- **Viewport prefetch** — `Link` accepts `prefetch="viewport"`; the sidebar and navbar top-level items already opt in. Prefetching downloads the route's lazy chunk and loader data (never the HTML) and is queued/dropped like hover prefetching.
- **View Transitions** track direction (`forward`/`back`) and respect `prefers-reduced-motion`; still behind `experimental.viewTransitions`.
- **File routing** supports dynamic segments (`[slug]`, `[...parts]`).
- **`redirects`** remains a stable, top-level configuration option (declared in `boltdocs.config.ts`, applied in the client router, the static output, and build validation).

Nothing to do. Adopt the new features deliberately (viewport prefetch per link, `experimental.*`, `redirects`).

## Upgrading to 4.0

4.0 is an architecture migration, not a bump. Before adopting it:

1. Read the roadmap page (`/roadmap`) and the 4.0 migration section.
2. Inventory your plugins against `@bdocs/contracts` — the contract layer is the stable seam 4.0 builds on.
3. Keep third-party plugins pinned to a `boltdocsVersion` range that excludes 4.x until they declare support.

## Upgrade checklist

- Read the release page for every version you cross, not just the target.
- Bump `boltdocs` and the official `@bdocs/plugin-*` packages you use together.
- Run `pnpm install` (not `npm`/`yarn` — Boltdocs is a pnpm workspace).
- Run `boltdocs build` locally before deploying; the build validates SEO, routes, and redirects.
- Run `boltdocs doctor` to catch stale internal links after large reorganizations.
- Check `boltdocs doctor --budget` if your team enforced build budgets.

## Troubleshooting

| Symptom | Likely cause / fix |
| --- | --- |
| `missingPeer react-aria-components` on install | You are on 3.2+ without declaring it — see [3.2.0](#upgrading-to-320) |
| `pnpm install --frozen-lockfile` fails once after a bump | Expected lockfile rewrite — run `pnpm install` without `--frozen-lockfile` once |
| Plugin compatibility error at startup | The plugin's `boltdocsVersion` range does not include your version |
| Broken internal links after moving pages | Use canonical `/docs/...` hrefs and run `boltdocs doctor --fix` |
| Search stale after config change | Clear the `.boltdocs/` cache (`BOLTDOCS_NO_CACHE=1` for a run) |
