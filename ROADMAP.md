# Boltdocs Roadmap

Estrategia para superar a Docusaurus **por mucho**.

---

## Estado Actual: Boltdocs vs Docusaurus

### ✅ Donde ya ganamos

| Área | Boltdocs | Docusaurus |
|---|---|---|
| **Build speed** | Rolldown (Rust) + worker pool paralelo | Rspack (mejoró, pero más lento) |
| **Search** | FlexSearch local sin costos recurrentes | Algolia DocSearch ($$$ para proyectos comerciales) |
| **Doctor CLI** | `boltdocs doctor` — auto-fix links rotos, traducciones, sidebar | No existe |
| **Changelog generator** | `boltdocs generate-changelog` — parses Changesets / Keep a Changelog → docs | No existe |
| **Plugin security** | Sandbox con permisos (fs:read, fs:write, vite:config, etc.) | Sin sandbox |
| **Styling** | Tailwind v4 + React Aria Components | Infima (obsoleto, poco mantenido) |
| **Caching** | Multi-nivel: MDX, rutas, frontmatter, SSG por página, directorios | Básico |
| **i18n** | Fallback automático, RTL, locale-aware en todos los componentes | Similar, pero builds más lentos |
| **Versioned docs** | Same-page mapping entre versiones, alias automático de default | Similar |
| **Analytics** | GA4 + GTM integrado | Plugin externo |
| **Image optimization** | Build-time (PNG, JPEG, WebP, AVIF, SVG) | Plugin externo |
| **Security headers** | CSP, HSTS, X-Frame-Options, etc. en producción | No incluye |
| **Plugin lifecycle** | Hooks: beforeBuild, afterBuild, beforeDev, afterDev, configResolved, buildEnd | Solo config + content |

### ❌ Donde nos falta

| Feature | Impacto | Esfuerzo |
|---|---|---|
| RSS / Atom feed | Bajo | Días |
| Blog (posts, tags, autores, paginación) | Medio | Semanas |
| Drafts / preview mode | Medio | Días |
| Incremental builds (solo páginas cambiadas) | **Alto** | Semanas |
| AI search (RAG semántico) | **Alto** | Semanas |
| Partial hydration / islands architecture | **Alto** | Meses |
| Streaming SSR en dev (percepción) | Bajo | Días |
| OpenAPI / Swagger con playground interactivo | Medio | Semanas |
| Multi-instance docs | Bajo | Semanas |
| Visual editor / CMS integration | Medio | Meses |
| React Server Components para contenido estático | Medio | Meses |
| Performance budgets en Doctor | Medio | Días |
| Preconnect / DNS-prefetch automático | Bajo | Horas |
| Build farm distribuido (multi-máquina) | Bajo | Meses |

---

## Plan Estratégico

Tres áreas de diferenciación real que nos colocan **muy por delante** de Docusaurus.

---

### 1. 🚀 Build Incremental + ISR

Docusaurus hace *full rebuild* en cada cambio. Boltdocs ya tiene caché por página (mtime).
Convertirlo en **incremental puro**:

- Solo rebuildear páginas cuyo source `.mdx` / `.md` cambió
- Solo rebuildear assets (CSS/JS) si hubo cambios en el bundle
- Detectar cambios en componentes compartidos (layout, MDX components) e invalidar páginas dependientes
- **Meta: builds de contenido en < 1s** vs ~15s de Docusaurus

**Archivos clave:**
- `packages/ssg/src/node/build.ts` — SSG pipeline, ya tiene caché por página
- `packages/core/src/node/routes/` — route generation con detección de cambios

---

### 2. 🤖 AI-Native Search + Content Quality

Docusaurus acaba de integrar AskAI (Algolia). Podemos tenerlo **mejor y sin vendor lock-in**:

**En el SSG build:**
- Generar embeddings vectoriales de cada página (modelo local tipo all-MiniLM-L6-v2, o API tipo OpenAI/Groq)
- Indexar embeddings en formato compatible con búsqueda vectorial local (transformers.js en el cliente, o librería vectorial tipo `vectra`)

**En el cliente:**
- Búsqueda semántica local con transformers.js (sin servidor, sin costos)
- Fallback a FlexSearch para matching exacto
- Resultados con "respuesta directa" generada por LLM (páginas informacionales)

**En el Doctor:**
- `boltdocs doctor --ai-quality` → analiza calidad del contenido (legibilidad, claridad, cobertura)
- Auto-generar `description` faltantes con LLM
- Detectar contenido desactualizado vs releases del repositorio

**Archivos clave:**
- `packages/core/src/node/search/` — generación de search data
- `packages/core/src/client/hooks/use-search.ts` — FlexSearch client
- `packages/core/src/node/doctor/` — health checks

---

### 3. 🏝️ Partial Hydration / Islands Architecture

Docusaurus hidrata toda la página → ~200KB JS inicial.
Con islas, podemos llegar a **< 30KB JS inicial**:

- Contenido estático (MDX renderizado) → cero JS, solo HTML + CSS
- Solo hidratar componentes interactivos (search, navbar, sidebar, theme toggle)
- Usar el pipeline existente de `renderToString` / `renderToPipeableStream` para el HTML estático
- Componentes interactivos envueltos en `ClientOnly` o un `<Island>` custom

**Meta:** Las páginas de documentación cargan con JS mínimo. El usuario solo descarga JS cuando interactúa.

**Archivos clave:**
- `packages/ssg/src/node/serverRenderer.tsx` — SSR rendering
- `packages/ssg/src/client/components/ClientOnly.tsx` — ya existe como base
- `packages/core/src/client/` — componentes a marcar como islas

---

## Quick Wins (Implementación Inmediata)

| # | Feature | Cómo | Archivos |
|---|---|---|---|
| 1 | **RSS / Atom feed** | Mismo patrón que sitemap. Generar `<link>` en `<head>` y archivo XML en `onFinished` | `packages/core/src/node/seo/rss.ts` (nuevo) |
| 2 | **Drafts** | Frontmatter `draft: true` + `process.env.NODE_ENV` para filtrar en route generation | `packages/core/src/node/routes/index.ts`, `packages/core/src/shared/types.ts` |
| 3 | **Streaming SSR en dev** | Cambiar `onAllReady` → `onShellReady` en `renderStaticApp` | `packages/ssg/src/node/serverRenderer.tsx` |
| 4 | **Preconnect / DNS-prefetch** | Analizar recursos cross-origin en la página y emitir `<link rel="preconnect">` | `packages/ssg/src/node/html.ts` |
| 5 | **Performance budgets en Doctor** | Warn si bundle > X KB o pages > Y ms de render | `packages/core/src/node/doctor/` |

---

## Priorización Recomendada

### Fase 1 (este mes)
- RSS / Atom feed
- Drafts / preview mode
- Streaming SSR en dev
- Preconnect automático

### Fase 2 (próximo mes)
- Build incremental (aprovechar caché existente)
- AI search (embeddings + búsqueda semántica)
- Performance budgets en Doctor

### Fase 3 (próximo trimestre)
- Partial hydration / islands
- Blog engine
- OpenAPI + playground interactivo
- React Server Components para contenido

---

*Última actualización: mayo 2026*
