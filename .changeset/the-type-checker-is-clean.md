---
'boltdocs': patch
'@bdocs/contracts': patch
'@bdocs/unist-utils': minor
'@bdocs/processor-satteri': patch
'@bdocs/theme-neutral': patch
---

The type checker is clean, and the highlighting configuration has one type.

**The `CodeHighlightConfig` drift is gone.**

Three packages declared the same configuration with three different shapes:
the contract layer's open one, the pipeline's narrow one, and the processor's
own copy. The engine produced the first and handed it to functions that
expected the second, and the type checker said so — nine errors in the core,
reported for months, in a package whose `tsc --noEmit` nobody ran.

The contract layer's type is the public one and stays open by design: an
engine with its own colour model cannot be enumerated. The pipeline's
normalizer now reads that type and *narrows* the theme to what it can use,
dropping a theme it cannot read rather than passing it on as a pair of
`undefined`s. The Shiki adapter does the same, and the cast that hid the
problem is gone.

**Two `tsconfig` files were not configuring anything.**

`@bdocs/unist-utils` and `@bdocs/processor-satteri` extended the repository's
root `tsconfig.json`, which is a solution file with no compiler options. The
type checker fell back to its defaults — no `module`, no `target`, no
`esModuleInterop` — and reported 39 errors that had nothing to do with the
code, while hiding the real ones. Both packages now configure themselves, and
the processor's 35 errors are 0.

**The search index types are a type alias.**

`SearchIndexParams` was an interface, and an interface has no implicit index
signature, so it was not assignable to the `Record<string, unknown>` the hook
chain threads its parameters through. The alias is, and the hook's own
signature accepts it.

**A renamed function was never updated.**

`@bdocs/theme-neutral`'s code block read `stateIsHighlighted`, which was
renamed to `isHighlighted` when the state module was split out. The call site
had been broken since; the type checker had been reporting it.

### Evidence

- `tsc --noEmit` is clean in the core, the runtime, the contracts, the
  primitives, the theme, the processor and the unist utils. The core went
  from 9 errors to 0, the processor from 35 to 0, the theme from 4 to 0.
- Every package's tests pass; the documentation site builds.
