---
'boltdocs': patch
---

Avoid static default imports when generating plugin MDX components. Named plugin components such as `@bdocs/plugin-math/client` do not need a default export, and using `Reflect.get` prevents Vite/Rolldown from emitting `IMPORT_IS_UNDEFINED` warnings during client and SSR builds.
