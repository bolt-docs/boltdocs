# Plan: `boltdocs theme:dev` — Theme Developer Preview Command

## Concept

Comando CLI para que theme developers **previsualicen sus temas** instantáneamente
sin crear un proyecto Boltdocs desde cero. Genera un proyecto temporal con contenido
MDX de muestra, inicia el dev server con HMR vía symlinks y limpia al salir.

```bash
boltdocs theme:dev                                          # layout default + components vacío
boltdocs theme:dev --layout ./mi-layout.tsx                 # layout symlinkeado con HMR
boltdocs theme:dev --layout ./x --mdx ./y                   # layout + MDX components
boltdocs theme:dev --layout ./x --mdx ./y --port 4000       # puerto custom
boltdocs theme:dev --layout ./x --tailwind                  # activar TailwindCSS v4
boltdocs theme:dev --layout ./x --plugins ./plugin-a.ts     # plugins adicionales
boltdocs theme:dev --layout ./x --verbose                   # logs completos
```

---

## Contrato de Diseño

### `--layout <path>` (opcional)
Ruta al `layout.tsx` del theme. Se crea un **symlink** a `docs/layout.tsx`
del proyecto temporal. Vite detecta cambios en el archivo original y dispara HMR.

Si no se provee, se genera un layout default que usa `DocsLayout` de `boltdocs/client`.

### `--mdx <path>` (opcional)
Ruta al `mdx-components.tsx` del theme. También **symlink** a `docs/mdx-components.tsx`.
Si no se provee, se genera `export default {}`.

### `--tailwind` (flag opcional)
Activa `@bdocs/plugin-tailwindcss` en el proyecto temporal. Requiere que el
paquete esté instalado en el proyecto del usuario.

### `--plugins <path...>` (opcional)
Uno o más archivos de plugins Boltdocs para incluir (e.g. `./mi-plugin.ts`).

### Comportamiento default (sin flags)
```bash
boltdocs theme:dev  # → layout default + components vacío + solo contenido MDX
```

---

## Estrategia de Dependencias (CRUCIAL)

### Cómo resuelve módulos el proyecto temporal

El proyecto temporal se crea en:
```
{userProject}/.boltdocs/theme-preview/preview-{timestamp}/
```

**Node.js module resolution** camina hacia arriba desde el temp dir:
1. `preview-{ts}/node_modules/` → no existe
2. `theme-preview/node_modules/` → no existe
3. `.boltdocs/node_modules/` → no existe
4. `{userProject}/node_modules/` → **existe!** Aquí están `boltdocs`, `react`, etc.

**Virtual modules** (`boltdocs/client`, `boltdocs/entry`):
- El plugin `virtual-modules.ts` intercepta estas importaciones
- Resuelve `boltdocs/client` caminando hacia arriba desde su propio `__dirname`
- (que está dentro de `node_modules/boltdocs/dist/...`)
- Encuentra el `package.json` de `boltdocs` y re-exporta desde `dist/client/index.js`
- **No necesita archivos físicos** en el root del temp project

**Vite SSR externals** (`@bdocs/ssg`, `react-router-dom`, etc.):
- Se resuelven desde `node_modules` del proyecto padre
- `createViteConfig` ya define las externalizaciones correctas

### Qué se necesita crear en el temp project

| Archivo | Propósito |
|---------|-----------|
| `package.json` | `{"type": "module", "private": true}` — Vite necesita saber que es ESM |
| `index.html` | Entry point de Vite (necesario para `optimizeDeps.entries`) |
| `boltdocs.config.ts` | Configuración del proyecto temporal |
| `docs/layout.tsx` | Symlink del --layout o default |
| `docs/mdx-components.tsx` | Symlink del --mdx o default vacío |
| `docs/*.mdx` | Contenido de muestra |

### Plugins adicionales (`--tailwind`, `--plugins`)

El `boltdocs.config.ts` generado hará imports como:
```typescript
import tailwindcssPlugin from '@bdocs/plugin-tailwindcss'
```

Node.js resolverá `@bdocs/plugin-tailwindcss` caminando hacia arriba hasta
`{userProject}/node_modules/@bdocs/plugin-tailwindcss`.

**Validación**: Antes de generar el config, verificamos que el paquete existe
en el `node_modules` del proyecto padre. Si no, mostramos error:
```
✖ @bdocs/plugin-tailwindcss no está instalado.
  Ejecuta: pnpm add -D @bdocs/plugin-tailwindcss tailwindcss
```

### Por qué NO necesitamos `pnpm install`

1. Node.js module resolution walk encuentra `node_modules` del proyecto padre
2. Virtual modules (`boltdocs/client`) se resuelven internamente por el plugin
3. Vite SSR externals se resuelven desde `node_modules` vía `require.resolve`
4. El `@bdocs/ssg/node` (createServer) se importa desde el código de `boltdocs`,
   no desde el temp project
5. Los alias en `createViteConfig` (`@`, `use-sync-external-store/shim`, etc.)
   apuntan a paths que se resuelven correctamente desde el temp project o son
   monorepo-specific (el alias `@` no se usa en proyectos normales)

---

## Symlinks: Estrategia para HMR

### Por qué symlinks y no copia
Si COPIAMOS `layout.tsx`, el usuario tiene que reiniciar `theme:dev` cada vez que
edita su archivo original. Con **symlink**:

1. `fs.symlinkSync(originalPath, tempPath, 'file')` crea un enlace
2. Vite usa `chokidar` para file watching
3. `chokidar` por defecto **sigue symlinks** (option `followSymlinks: true`)
4. Usuario edita `layout.tsx` original → HMR actualiza sin reiniciar

### Cross-platform fallback
- **Linux/macOS**: `fs.symlinkSync` funciona directo
- **Windows**: Si falla, hacer copy con mensaje informativo

### Vite config
```typescript
server: {
  watch: {
    ignored: ['**/.boltdocs/cache/**'],
  },
}
```

---

## CSS y TailwindCSS

### Vanilla CSS
Funciona out-of-the-box. El `layout.tsx` symlinkeado puede hacer:
```tsx
import './estilos.css'  // resuelve relativo al archivo original
```

### TailwindCSS (`--tailwind`)
Agrega `@bdocs/plugin-tailwindcss` a la config temporal:
```typescript
// boltdocs.config.ts generado
import tailwindcssPlugin from '@bdocs/plugin-tailwindcss'

export default defineConfig({
  plugins: [
    tailwindcssPlugin(),
  ],
})
```

El layout.tsx del theme importa su CSS con directivas `@tailwind`:
```css
@import "tailwindcss";
@theme { ... }
```

### En producción (cuando se distribuye el theme)
El proyecto que instala el theme necesita:
```bash
pnpm add -D @bdocs/plugin-tailwindcss tailwindcss
```

```ts
// boltdocs.config.ts del proyecto consumidor
import tailwindcssPlugin from '@bdocs/plugin-tailwindcss'
import miTheme from 'mi-theme'

export default defineConfig({
  plugins: [
    tailwindcssPlugin(),
    miTheme(),
  ],
})
```

El `layout.tsx` del theme (dentro de `node_modules/mi-theme/`) importa su propio CSS.

---

## High-level Flow

```
User runs:
  boltdocs theme:dev --layout ./layout.tsx --mdx ./components.tsx --tailwind
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│ 1. Parse flags                                           │
│    • Resolver paths absolutos                            │
│    • Validar que existan los archivos                    │
│    • Validar dependencias (--tailwind → check installed) │
└──────────────────────┬───────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────┐
│ 2. Crear proyecto temporal en:                          │
│    .boltdocs/theme-preview/preview-{timestamp}/           │
│                                                          │
│    📁 preview-{ts}/                                      │
│    ├── package.json          ← {"type": "module"}       │
│    ├── index.html            ← entry point de Vite      │
│    ├── boltdocs.config.ts    ← config con plugins       │
│    └── 📁 docs/                                          │
│        ├── layout.tsx         ← SYMLINK de --layout    │
│        │                        o default layout         │
│        ├── mdx-components.tsx ← SYMLINK de --mdx       │
│        │                        o export default {}      │
│        ├── index.mdx                                    │
│        ├── guides/                                      │
│        │   ├── getting-started.mdx                       │
│        │   ├── typography.mdx                            │
│        │   ├── lists.mdx                                 │
│        │   ├── tables.mdx                                │
│        │   ├── code.mdx                                  │
│        │   └── media.mdx                                 │
│        └── examples/                                     │
│            └── advanced.mdx                              │
└──────────────────────┬───────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────┐
│ 3. Iniciar dev server (programmatic)                     │
│    • createViteConfig(tempDir, 'development', config,    │
│        { skipTypes: true, skipLinkTree: true })           │
│    • createServer(viteConfig)                             │
│    • server.listen()                                      │
│    • Mostrar URL                                          │
└──────────────────────┬───────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────┐
│ 4. On SIGINT/SIGTERM: clean up                           │
│    • server.close()                                       │
│    • fs.rmSync(tempDir, recursive)                       │
│    • process.exit(0)                                      │
└──────────────────────────────────────────────────────────┘
```

---

## Archivos a Crear/Modificar

| Archivo | Acción |
|---------|--------|
| `packages/core/src/node/cli/theme.ts` | **CREAR** — Lógica principal |
| `packages/core/src/node/cli-entry.ts` | **MODIFICAR** — Registrar comando |

---

## `packages/core/src/node/cli/theme.ts` — Estructura

```typescript
// ─── Interfaces ─────────────────────────────────

export interface ThemeDevOptions {
  port?: number
  host?: string | boolean
  name?: string
  layout?: string       // Path al layout.tsx para symlink
  mdx?: string          // Path al mdx-components.tsx para symlink
  plugins?: string[]    // Paths a plugins adicionales
  tailwind?: boolean    // Activar TailwindCSS v4 plugin
  verbose?: boolean
}

// ─── Comando principal ──────────────────────────

export async function themeDevAction(
  root: string,
  options: ThemeDevOptions = {},
): Promise<void>

// ─── Funciones internas ─────────────────────────

function checkDependency(packageName: string, rootDir: string): boolean
function createTempProject(root: string, options: {...}): string
function createSymlink(target: string, linkPath: string): void
function writePackageJson(dir: string): void
function writeIndexHtml(dir: string): void
function writeConfigFile(dir: string, title: string, options: {...}): void
function writeLayoutFile(dir: string, sourcePath?: string): void
function writeMdxComponentsFile(dir: string, sourcePath?: string): void
function writeSampleContent(dir: string): void
function cleanup(dir: string): void
```

---

## Contenido MDX Generado (7 páginas)

Solo elementos MDX estándar — h1-h6, p, blockquote, ul, ol, table, code, hr, a, img, strong, em, del, task lists, definition lists, details/summary.

### index.mdx — Homepage
### guides/getting-started.mdx
### guides/typography.mdx — h1-h6, p, blockquote, hr
### guides/lists.mdx — ul, ol, tasks, definitions
### guides/tables.mdx — simple, aligned, complex
### guides/code.mdx — TS, Python, Bash, JSON, diff, line highlighting
### examples/advanced.mdx — Full page demo combinando todo
