---
"@bdocs/ssg": minor
---

Clean up and restructure SSG build output:

- Suppress verbose Vite/Rolldown asset chunk listing (80+ individual lines) during client build
- Add clean summary lines for client and server build completion
- Add visual dividers between build phases (client, server, rendering, loader data)
- Replace per-page rendering output (68 individual lines) with a single summary counter
- Filter unnecessary warnings and progress messages from build output
- Use success() from @bdocs/dui for phase completion messages
