---
'@bdocs/plugin-mermaid': minor
'boltdocs': patch
---

Fix mermaid pages having extra scroll space at the bottom

- Fix body scroll bug: changed `min-height: 100%` to `height: 100%; overflow: hidden` on html/body in reset.css to prevent the browser scrollbar from appearing on all pages
- Mermaid SVG cleaning now uses DOMParser to only strip sizing attributes from the root `<svg>` element, preserving inner element styles (transforms, font-size) that mermaid uses for node positioning
- Added `not-prose` class to mermaid wrapper to prevent Tailwind typography plugin from adding margins to the SVG
- Added `margin: 0 !important` to mermaid SVG CSS as additional safety
- Added `overflow: hidden` to the root SVG element via cleanSvg
- Moved `<style>` tag inside the mermaid container div to avoid prose layout interference
