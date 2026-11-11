---
"boltdocs": minor
"@bdocs/theme-neutral": minor
"create-boltdocs": minor
---

Make the core CSS-agnostic: remove Tailwind/Vite Tailwind coupling and CSS-framework assumptions from the engine and neutral theme, replace `cn` with framework-neutral `clsx` class joining (no Tailwind merge), ship the neutral theme as plain CSS only, and update scaffolding/templates to opt into Tailwind explicitly via `@bdocs/plugin-tailwindcss` when needed.
