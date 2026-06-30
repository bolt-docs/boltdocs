---
"@bdocs/zig-critters": minor
---

- **Smart Selector Filtering & Size Budget**:
  - Exclude layout-related classes (sidebar, navbar, toc, etc.) from critical CSS inlining.
  - Exclude complex selectors (> 2 parts) natively in Zig.
  - Implement an 8 KB size budget in JS to discard critical CSS if the payload is too large.
