# Boltdocs Spec — The Unbreakable Contract

> **This is the contract.** Every feature, every plugin, every release is
> measured against this document. If a change breaks one of these principles,
> the change is wrong — no matter how fast it builds or how nice the demo looks.
>
> Read this before writing code, before opening a PR, and before merging one.

---

## 1. Why Boltdocs exists

Documentation is a product, not an afterthought. Most doc tools force you to
choose: a fast static site with a weak authoring experience, or a rich MDX
platform that is slow to build and painful to maintain. Boltdocs exists to
remove that trade-off.

**Boltdocs wants to be the standard for documentation.** Not just another tool
with a nice demo — the default teams reach for when they document: write MDX,
ship a site that feels instant, and keep full control of content, structure,
and brand. A standard can't assume a UI framework, a CSS setup, or a backend,
which is exactly why this contract exists and why the core is kept
opinion-free. Everything that makes Boltdocs feel complete in the hands of a
specific team lives in plugins, never hard-wired into the engine.

The promise, in one sentence:

> **Write MDX like you mean it, ship a site that feels instant, and never
> fight the tool for control.**

Three forces drive every decision:

1. **The reader deserves speed.** A docs site is read dozens of times by the
   same person. Every millisecond of startup, navigation, and search is paid
   over and over. Performance is a feature, not a nicety.
2. **The author deserves ownership.** Your content, your structure, your
   components, your brand. Boltdocs provides strong defaults and zero lock-in;
   when you need something custom, the escape hatch is a file, not a fork.
3. **The ecosystem deserves trust.** Plugins must be safe to install and
   predictable to run. The core must not assume a CSS framework, a UI library,
   or a backend. Everything optional stays optional.

---

## 2. Non-negotiables (the unbreakable rules)

These are the rules that cannot be bent, skipped, or deferred "to a later
release". If you find yourself explaining why one of these doesn't apply,
stop and reconsider the approach.

### 2.1 The core is CSS-agnostic

The core ships **zero CSS framework assumptions**. Vanilla CSS, CSS Modules,
custom properties, and the built-in theme tokens work out of the box. Tailwind,
SASS, and UnoCSS are explicit plugins — never hard dependencies.

### 2.2 Performance is benchmarked, not promised

Every release is measured against a reproducible 100-page benchmark:

- **Cold build** must improve or hold against the previous published run.
- **Dev startup** and **incremental rebuilds** must not regress.
- Numbers quoted in release posts must match the committed benchmark data.
  A claim without a measurement is a bug.

> **Benchmark definition:** the 100-page benchmark consists of 100 MDX pages
> with an average of 5 custom components, 3 code blocks, 2 tables, and 1,500
> words per page, using the default theme and no external plugins.

> **Run it:** `pnpm run benchmark` runs the micro-benchmark suites, and
> `pnpm run benchmark:gate` enforces the regression rule against the committed
> cold-build baseline — failing the build when the cold benchmark regresses.

### 2.3 Plugins are validated, scanned, and versioned

- Plugin schemas are strict (Zod). Duplicate names, traversal paths, and
  version mismatches are rejected.
- `boltdocs audit` statically scans plugins for risky calls — without
  executing them. It **fails the build**: the project cannot start or build
  while a scan is incomplete or risky calls are detected, until the issue is
  resolved.
- Every plugin declares `name`, `version`, and the `boltdocs` range it
  supports. Compatibility is checked at load time.

### 2.4 MDX is the source of truth

Content is MDX. Frontmatter drives metadata, routes, collections, and SEO.
The parser (Sätteri) must never lose fidelity: code blocks, HTML, tables, and
custom components survive the round-trip intact. `_`-prefixed files stay
internal; `pages-external/` is the escape hatch for bespoke pages.

### 2.5 Opt-in stays opt-in

Experimental features (`viewTransitions`, `fileRouting`) are off by default
and degrade gracefully when a browser or project does not support them.
Enabling an experimental flag must never break the default experience.

### 2.5.1 Experimental → stable graduation (pending)

A feature graduates from experimental to stable only when **all** of the
following are true:

- It has shipped in at least **two consecutive minor releases** without
  breaking changes.
- At least **three real-world projects** have adopted it and reported no
  critical bugs.
- It has **benchmark data** showing no regression in cold build, dev startup,
  or navigation.
- There is **documented adoption guidance** and a migration path from the
  previous stable behavior (if any).

> **"Real-world project"** means a project outside the boltdocs monorepo that
> runs Boltdocs in production, is publicly observable (or has a maintainer
> with verifiable evidence), and actually exercises the feature in a real,
> non-toy path. The docs site itself, fixture apps, and demo/template
> scaffolds do **not** count.
>
> Eligibility is validated by the **Boltdocs team**, not self-declared.

### 2.6 Compatibility is a promise

- Semver is respected: breaking changes only in majors, with a migration
  guide.
- Public API surface is stable within a major version. `primitives` and
  `ui-base` stay stable public API, but from `4.0.0` they ship in their own
  packages, not through the `boltdocs` entry point.
- Section 6 is the single sanctioned exception: the `3.0.0 → 4.0.0` core
  cleanse. During `3.x` nothing is removed — moved APIs keep working through
  a `legacy/` alias; physical removal happens only in `4.0.0`.
- Deprecated APIs remain available for **at least one full major version**
  after deprecation (e.g., deprecated in `3.x`, removed in `4.0.0` at the
  earliest), with the `legacy/` entry point providing the migration path.
- The official docs site must behave identically for every visitor —
  experimental features stay off in production docs.

### 2.7 The repo stays green

- `pnpm` is the only package manager. Never `npm` or `yarn`.
- Biome formatting with `formatWithErrors` is enforced — single quotes, no
  semicolons, 2-space indent.
- TypeScript strict mode, `import type` for types, and the `@` alias for
  `packages/core/src`.
- Every non-trivial change ships with tests, and the full suite must pass
  before release.

### 2.8 React is the UI framework by default

Boltdocs ships **React** as its UI framework — the default and, today, the
only supported binding. This is a stable part of the contract, not an accident
of implementation. Multi-framework support is explicitly not planned (§6),
and changing the default UI framework would be a major-version decision
requiring a full migration guide.

### 2.9 Legacy code is temporary, never permanent

Legacy code is a price. Every `legacy/` shim that survives must be built,
tested, and shipped on every release, and it slows the engine for every user
who does not need it. Boltdocs therefore does **not** keep compatibility code
in the long term, and never across two majors at once.

The rule, concrete:

- A major upgrade is **all-or-nothing**: either you stay on the major you are
  on, or you migrate to the next one. `5.0.0` does **not** carry a `legacy/`
  facade for `4.x` the way `4.x` carried one for `3.x`.
- The path to a new major is always through the previous major
  (`4.0.0 → 5.0.0`) — never through a permanently maintained compatibility
  layer that keeps two majors alive in parallel.
- A major never accumulates the deprecations of the ones before it. Old
  surface is removed or migrated in its own major, never stacked.
- The **only** sanctioned `legacy/` memory is the single `3.0.0 → 4.0.0`
  transition granted in §2.6 and §6. Once `4.0.0` ships, that entry is
  **deleted** — it exists to get users from `3.x` to `4.x`, nothing more.

The reason: keeping compatibility layers for both `4.x` and `5.x` alive in
parallel would bloat the package, slow the stack, and contradict the benchmark
contract (§2.2). The price of this rule is that major upgrades must be
planned — every major ships with a complete migration guide (§3.4), and teams
are expected to land within one version window.

**The one carve-out: critical security support.** Teams that cannot migrate
within a single cycle are not abandoned. The previous stable major keeps an
**end-of-life security window**: only critical security fixes are backported —
no new features, no new API surface — until a published EOL date. This is a
security obligation, not a second feature track; it never resurrects removed
APIs and never grows the current major's surface.

---

## 3. How we decide

When a feature is proposed, it must answer five questions before any code:

1. **Who does this serve?** Reader, author, or ecosystem? (All three is ideal;
   none is a reject.)
2. **Does it respect section 2?** If it touches the core, does it stay
   CSS-agnostic? Does it add a benchmark? Does it keep opt-ins opt-in?
3. **Is it a plugin or core?** Content features, integrations, and third-party
   concerns belong in plugins. Core owns routing, MDX, config, and the
   contract.
4. **What is the migration cost?** Every breaking change needs a guide and a
   clear `before → after`. If the migration is painful, the design is wrong.
5. **What is the minimum that ships?** Scope tight, ship small, iterate.
   A focused plugin shipped this week beats a perfect framework shipped never.

Rejected without discussion: features that hard-code a CSS framework, that
slow the default experience, that execute plugin code without validation, or
that fork the public API surface without a major version.

---

## 4. Definition of done

A task is done only when **all** of the following are true:

- [ ] Feature or fix implemented against this spec
- [ ] Tests written and passing (`pnpm test`)
- [ ] Typecheck passes (strict TypeScript)
- [ ] Biome format + lint clean (`pnpm run format`)
- [ ] Docs updated (EN + ES when applicable) with no broken links
- [ ] Changeset added with the correct bump type (patch/minor/major)
- [ ] Benchmark impact measured when performance is involved
- [ ] No regression in the default (non-experimental) experience

If a checklist item is not applicable, say why — in the PR description, not
silently.

---

## 5. The unbreakable core

The core has exactly one shape, and the whole system converges on it. Today
the engine still ships a client side — themed layouts, `primitives`,
`ui-base`, contexts, and the React binding — inside it. That is the debt
§6 removes.

By `4.0.0` the core ships only:

```
boltdocs
├── Routing + SSG
├── MDX pipeline
├── Config + validation
└── Virtual modules
```

The client experience — `primitives`, `ui-base`, the theme, and the React
binding — lives in opt-in packages outside the core (see §6). Everything else
— CSS frameworks, analytics, search, math, diagrams, commenting, AI — lives
in plugins. The core stays small, fast, and opinion-free. That is the
unbreakable contract.

---

## 6. The 3.0.0 → 4.0.0 core cleanse

This contract also acknowledges the current debt. Today the core carries
`primitives`, `ui-base`, and a single UI-framework binding (React) inside the
engine — a concrete violation of §2.1 (CSS-agnostic) and an exception to
§2.6, sanctioned here precisely because we are actively fixing it. The core
is not yet a pure engine; it is a UI stack wearing an engine.

This is a broken bridge between the promise and the code, and it gets fixed
over the **3.0.0 → 4.0.0** window. The goal: separate everything that is not
the documentation engine until the core looks like this and only this:

```
boltdocs
├── Routing + SSG
├── MDX pipeline
├── Config + validation
└── Virtual modules
```

Everything that currently lives in the core but does not belong to the engine
moves out to first-class plugins by `4.0.0`:

- `primitives` — the low-level layout layer, extracted to its own package.
- `ui-base` — the reusable UI primitives, extracted to its own package.
- Theming tokens & the built-in theme — extracted to their own package.
- The React binding — stays the default and only supported UI framework, but
  moves out of the core into its own package. Multi-framework support is
  explicitly NOT a goal of this window.
- The default layout / client shell — moved to the theme package.
- Every integration (search, analytics, math, diagrams, AI, comments,
  cookies) — already plugin territory, and it stays there.

Rules that govern the cleanse:

1. **No new bloat.** No feature is added to `primitives`, `ui-base`, or the
   React binding that is not also extracted and moved out before `4.0.0`.
   Bloat is measured in the **final production bundle**, not in source bytes:
   the gzipped size of the `boltdocs` entry point, the count of runtime
   imports resolved from it, and the gzipped bytes the core contributes to the
   built output. Every PR touching the core must report this before/after; a
   change that grows the production footprint without an accompanying removal
   or extraction plan is rejected.
2. **Deprecate, then remove.** APIs that leave the core keep working through
   a `legacy/` entry point during `3.x`; they are physically removed only in
   `4.0.0`, each with a clear `before → after` migration guide (§3.4).
3. **Clean boundary, not multi-framework.** The core compiles and routes
   without importing React — the binding lives in its own package and stays
   the only supported binding. Multi-framework support is explicitly NOT a
   goal of this window or any currently planned one.
4. **Moved, not removed.** `primitives` and `ui-base` ship as official,
   independent packages (or plugins), so teams keep the defaults they already
   use without lock-in — they simply opt in now.
5. **The default stays one command.** A default theme package is bundled into
   a fresh `create-boltdocs` scaffold, so a new user lands on a working,
   styled site without touching configuration. This is how §2.5 holds once
   `primitives`, `ui-base`, and the theme leave the core.
6. **Kept accountable.** The §2.2 benchmark still gates every release during
   the cleanse. The core getting smaller must never regress the default
   experience.
7. **The vision holds.** "Gets a nice foundation" is not done until the core
   is clean — only the four blocks above ship from the engine and everything
   else is opt-in.

The intent of this section: by `4.0.0` the core is a pure documentation
engine. The styled UI, the framework binding, the themes, and every
integration live in optional packages. That is what "the ecosystem deserves
trust" (§1) and "everything optional stays optional" (§2.1) mean in
practice — and it is what lets Boltdocs become the documentation standard
without locking anyone into its assumptions.
