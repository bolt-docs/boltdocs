# SSG Build Output Improvements

## Overview

Improve the console output during `pnpm run build` to be cleaner, more structured, and better leverage the `@bdocs/dui` package utilities.

## Phases

- [x] Phase 1: Suppress verbose client build chunk listing + add summary line
- [ ] Phase 2: Add visual structure with dividers between build phases
- [ ] Phase 3: Improve rendering output (group/summary instead of per-page)
- [ ] Phase 4: Leverage @bdocs/dui properly across SSG build output
- [ ] Build and verify output changes

## Details

### Phase 1
- Modify `clientLogger` in `packages/ssg/src/node/build.ts` to filter out the individual asset/chunk file listing and gzip size computation
- After client build, print a single summary: `[boltdocs] Client build complete -- N assets, X total`
- Also apply similar filtering for the server build

### Phase 2
- Add `dividerLog()` from `@bdocs/dui` between build phases:
  - Before client build
  - Between client and server build
  - Between server build and rendering
  - Between rendering and loader data generation
  - At the end before "Build finished."

### Phase 3
- Instead of printing each rendered page individually, show a single summary line at the end
- In debug/verbose mode, retain per-page output

### Phase 4
- Review all output in the SSG build pipeline and ensure consistent use of `info`, `success`, `warn`, `error` from `@bdocs/dui`
- Ensure no raw `console.log` is used
- Remove any emoji characters from build output

## Progress

| Phase | Status | Date |
|-------|--------|------|
| 1 | Completed | 2026-05-26 |
| 2 | Pending | - |
| 3 | Pending | - |
| 4 | Pending | - |
| Verification | In progress | 2026-05-26 |
