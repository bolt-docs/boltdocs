---
'boltdocs': patch
---

Fix locale selector becoming unresponsive after switching languages. An optimistic store write re-rendered the shell's route sync while the router location was still stale (navigation lands on a later task), reverting the locale preference mid-navigation; the next selector interaction compared against the rolled-back value and silently no-op'd. The store write is now propagated synchronously to the router's locale registry and route syncing matches against the live browser URL, also fixing EN↔ES switching from localized external pages (e.g. `/es` → `/`).
