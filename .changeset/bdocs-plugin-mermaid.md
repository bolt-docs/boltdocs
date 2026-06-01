---
"@bdocs/plugin-mermaid": minor
---

- **Dynamic lazy loading**: Refactored the core library import to load Mermaid dynamically only when a page contains diagrams, optimizing the client bundle size.
- **Configuration serialization fix**: Fixed theme configurations not being correctly parsed and rendered on client components, and improved the initial loading placeholder.
