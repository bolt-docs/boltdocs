---
'boltdocs': patch
'@bdocs/ssg': patch
'@bdocs/zig-critters': patch
---

Make every package installable and documented.

- `@bdocs/ssg` no longer declares `@bdocs/zig-critters` as a required
  dependency; it stays optional, matching the existing runtime fallback to
  `beasties` or disabled critical CSS.
- `@bdocs/zig-critters` is now published so the optional fast path is actually
  available on npm (the previous `@bdocs/ssg` release pointed at a package that
  did not exist).
- Add a `check:publishable` guard, run in CI, that fails when a published
  package depends on a private or missing workspace package.
- Add a README to all 31 packages. Companion packages document the full install
  bundle instead of pretending to be standalone; internal packages explain why
  they are not published.
