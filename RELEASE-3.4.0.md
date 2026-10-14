# Boltdocs 3.4.0 Release Checklist

Target line: `develop`
Target version: `boltdocs@3.4.0`
Status: preparation in progress

This release is the stable, backward-compatible line. The 4.0 architecture migration is paused on the `4.0` branch and must not leak breaking changes into 3.4.0.

## Release scope

### Included

- `@bdocs/contracts` published as a new public package.
- Framework-neutral contracts for routes, plugin lifecycle, plugin definitions, highlighting, search documents, and configuration.
- Backward-compatible re-exports from `boltdocs` for every moved type.
- Vite 8.1 alignment across core, SSG, Sätteri, plugins, docs, and the benchmark fixture.
- Content-addressed SSG page cache with source-based route identity.
- Single edited page re-renders only the affected route.
- Single-miss MDX precompile without starting the compile pool.
- Ask AI integration completion: multi-provider support, hardened adapters, accessible chat UI, rate limiting, and request limits.
- Search relevance, snippets, cancellation, and HMR updates.
- Route and locale resolution indexes.
- Accessibility fixes validated with axe and Playwright.
- Fair Boltdocs versus Docusaurus Faster benchmark with cold-cache isolation.

### Excluded from 3.4.0

- Package extraction of `ui-base` into `@bdocs/ui`.
- Package extraction of primitives into `@bdocs/primitives`.
- `@bdocs/runtime` split.
- SEO plugin extraction.
- Removal of private imports or deprecated APIs.
- Any breaking change to configuration, plugin, or component APIs.

## Version plan

| Package | Current | Bump | Target |
| --- | --- | --- | --- |
| `boltdocs` | 3.3.6 | minor | 3.4.0 |
| `@bdocs/ssg` | 0.4.4 | minor | 0.5.0 |
| `@bdocs/processor-satteri` | 0.3.4 | minor | 0.4.0 |
| `@bdocs/plugin-ask-ai` | 0.3.1 | minor | 0.4.0 |
| `@bdocs/contracts` | 0.0.0 | minor | 0.1.0 |
| `@bdocs/plugin-math` | 4.0.3 | patch | 4.0.4 |
| `@bdocs/plugin-sass` | 0.0.2 | patch | 0.0.3 |
| `@bdocs/plugin-unocss` | 0.0.2 | patch | 0.0.3 |

`@bdocs/contracts` starts at `0.0.0` because it has never been published. The minor changeset produces the first public release, `0.1.0`.

## Changesets

Two changesets prepare the release:

- `.changeset/release-3-4-0.md` — minor bumps for the architecture line.
- `.changeset/release-3-4-0-patches.md` — patch bumps for maintenance packages.

Do not merge these changesets to `main` until the release is explicitly approved. The release workflow runs on every push to `main`.

## Verification gate

- [ ] `pnpm install` completes without new errors.
- [ ] `pnpm run test:core` passes.
- [ ] `pnpm run test:ssg` passes.
- [ ] `pnpm run test:plugins` passes.
- [ ] `pnpm run test:processors` passes.
- [ ] `pnpm run build` completes with every task successful.
- [ ] `pnpm -C docs build` completes and the SSG output is valid.
- [ ] `pnpm run test:a11y` passes.
- [ ] Benchmark comparison against Docusaurus Faster is recorded.
- [ ] `pnpm exec changeset status` shows only the intended bumps.
- [ ] `git diff --check` is clean.
- [ ] Release notes reviewed for public wording.
- [ ] Release approved explicitly before merging to `main`.

## Rollout

1. Land the release preparation on `develop`.
2. Run the full verification gate.
3. Review the generated changelog entries.
4. Merge `develop` into `main` with release automation enabled.
5. Let the changesets workflow open the version PR.
6. Review the version PR and merge it to publish to npm.
7. Tag and announce `boltdocs@3.4.0`.

## Rollback

If verification fails on `develop`, revert the release preparation commits. No published version is affected until the changesets version PR is merged on `main`.
