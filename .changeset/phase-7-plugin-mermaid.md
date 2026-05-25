---
"@bdocs/plugin-mermaid": patch
---

Replace node-side `console.warn` with `warn()` from `@bdocs/dui`. Client-side error logging in `Mermaid.tsx` left unchanged (browser context, dui is node-only).
