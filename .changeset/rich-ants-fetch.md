---
"@bdocs/plugin-mermaid": minor
---

feat: optimize mermaid bundle and fix dead theme config

- Replace static `import mermaid from 'mermaid'` with dynamic `await import('mermaid')` inside useEffect. Mermaid now loads as a separate chunk only on pages that contain diagrams (~27KB savings for pages without diagrams).
- Fix dead `clientContext` config — theme settings (light/dark) are now serialized into each `<Mermaid>` element as a JSX attribute value expression, ensuring user-provided themes actually reach the client component.
- Improve loading state — show raw mermaid source code as preview while the library loads, instead of an empty `animate-pulse` container.
- Remove unused `clientContext` from plugin return value.
