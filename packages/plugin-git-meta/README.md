# @bdocs/plugin-git-meta

Git-derived page metadata for Boltdocs: **last-updated dates** and **contributor lists**, backed by a single cached `git log` scan. The package also ships customizable React components for rendering that metadata.

- [English](#english)
- [Español](#español)

---

## English

### What is this package?

`@bdocs/plugin-git-meta` contains two independent plugins:

| Plugin | Adds | Source |
| :--- | :--- | :--- |
| `lastUpdatedPlugin()` | `route.lastUpdated` | Last non-merge commit touching the page |
| `contributorsPlugin()` | `route.contributors` | Authors of every non-merge commit touching the page |

Both use the `routes:resolved` lifecycle hook, so the metadata reaches the SSG route table as well as the client route module. The default page footer renders the date automatically, and `contributorsPlugin()` mounts the exported `Contributors` component in the footer through the `page:footer:start` client slot.

### Why use it?

- **No frontmatter bookkeeping.** Dates and authors come from the repository history you already maintain.
- **One scan, two plugins.** The git log is parsed once per repository + docs directory + `HEAD` and shared between both plugins.
- **Server-rendered UI.** The footer slot is imported eagerly, so contributors appear in the static HTML instead of after hydration.
- **Customizable by design.** Every component accepts class slots and render props; `autoRender: false` lets you own the layout completely.
- **Private by default.** Contributor emails are never sent to the client unless you opt in.

### Installation

```bash
pnpm add @bdocs/plugin-git-meta
```

### Quick start

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import {
  contributorsPlugin,
  lastUpdatedPlugin,
} from '@bdocs/plugin-git-meta'

export default defineConfig({
  plugins: [
    lastUpdatedPlugin({ fallbackToMtime: true }),
    contributorsPlugin({ max: 8 }),
  ],
})
```

Both plugins are optional and independent. Register only the one you need.

### How it works

```text
git history
   │
   ▼
single `git log --name-only` scan (cached by repo + docsDir + HEAD)
   │
   ▼
routes:resolved hook
   ├── lastUpdatedPlugin  → route.lastUpdated
   └── contributorsPlugin → route.contributors
   │
   ▼
SSG route table + virtual:boltdocs-routes
   │
   ▼
page footer (slot `page:footer:start`) + default last-updated date
```

Only **non-merge commits** are considered. Dates are committer dates (`%cI`) normalized to ISO-8601. Contributors are grouped by lower-cased email before the optional display-name merge.

### `lastUpdatedPlugin()` options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `fallbackToMtime` | `boolean` | `false` | Use the file modification time when git has no history for a page (untracked file, shallow clone, page generated from a virtual source). |
| `overrideFrontmatter` | `boolean` | `false` | Replace a string or `Date` written in `lastUpdated` frontmatter with the git date. |
| `paths` | `string[]` | — | Only process routes whose path starts with one of these prefixes. |
| `excludePaths` | `string[]` | — | Skip routes whose path starts with one of these prefixes. |

Date precedence for each page:

1. Explicit `lastUpdated` frontmatter (`string` or `Date`) — unless `overrideFrontmatter` is enabled.
2. Last non-merge git commit that touched the file.
3. File modification time — only when `fallbackToMtime` is enabled.
4. The existing route value, untouched.

> A numeric `lastUpdated` in frontmatter is the core's file-mtime fallback, not an author-provided date, so git is allowed to replace it.

Example:

```ts
lastUpdatedPlugin({
  fallbackToMtime: true,
  excludePaths: ['/changelog'],
})
```

### `contributorsPlugin()` options

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `max` | `number` | `12` | Maximum contributors stored per page (1–100). |
| `order` | `'commits' \| 'recent'` | `'commits'` | Rank by total commits or by the latest contribution. |
| `excludeBots` | `boolean` | `true` | Drop automation accounts such as dependabot, renovate, `[bot]` identities, and `copilot-swe-agent`. |
| `excludeAuthors` | `string[]` | `[]` | Names or emails to exclude. |
| `minCommits` | `number` | `1` | Ignore contributors below this commit count. |
| `mergeByName` | `boolean` | `true` | Combine identities that share a display name. |
| `includeEmail` | `boolean` | `false` | Include the author email in route metadata. |
| `autoRender` | `boolean` | `true` | Mount `Contributors` in the default page footer. |
| `profiles` | `Record<string, Profile>` | `{}` | Per-identity overrides keyed by email or display name. |
| `paths` | `string[]` | — | Only process routes whose path starts with one of these prefixes. |
| `excludePaths` | `string[]` | — | Skip routes whose path starts with one of these prefixes. |

A `Profile` accepts `name`, `avatar`, and `url`; `avatar` and `url` must be valid URLs.

#### Identity resolution

1. Look up `profiles[email]`, then `profiles[displayName]` (case-insensitive).
2. Derive an avatar and profile URL automatically for GitHub noreply emails (`12345+user@users.noreply.github.com`).
3. Filter bots and `excludeAuthors`.
4. Apply `minCommits`.
5. Merge identities with the same display name when `mergeByName` is enabled.
6. Sort by commits (or recency) and apply `max`.

Example:

```ts
contributorsPlugin({
  max: 8,
  order: 'commits',
  profiles: {
    'jane@example.com': {
      name: 'Jane Doe',
      avatar: 'https://github.com/janedoe.png?size=64',
      url: 'https://github.com/janedoe',
    },
  },
  excludeAuthors: ['docs-bot@example.com'],
})
```

### Rendering: automatic footer

`contributorsPlugin()` registers the exported `Contributors` component on the `page:footer:start` slot. The default layout renders it to the left of the last-updated date:

```text
┌──────────────────────────────────────────────────────────────┐
│ [avatars] Jesús Alcalá             Last updated on May 3, 2026 │
└──────────────────────────────────────────────────────────────┘
```

The slot is imported eagerly by the generated client registry so it participates in SSR and hydration. Disable the automatic mount when you want to render the components yourself:

```ts
contributorsPlugin({ autoRender: false })
```

### Components

Import from the client entry, never from the node entry:

```tsx
import {
  Contributors,
  GitMetaFooter,
  LastUpdated,
} from '@bdocs/plugin-git-meta/client'
```

These are framework components: they depend on React and on the Boltdocs client runtime (`useRoutes`, theme tokens). The node entry stays dependency-free apart from `zod`.

#### `Contributors`

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `contributors` | `RouteContributor[]` | — | Data, usually `route.contributors`. |
| `max` | `number` | `5` | Contributors rendered before collapsing into `+N`. |
| `size` | `'sm' \| 'md'` | `'sm'` | Avatar and text size preset. |
| `showAvatars` | `boolean` | `true` | Render the avatar stack. |
| `showNames` | `boolean` | `true` | Render the name list. |
| `label` | `string` | `'Contributors'` | Accessible label for the group. |
| `classNames` | `ContributorsClassNames` | — | Class slots: `root`, `avatars`, `avatar`, `names`, `name`, `link`, `trailing`. |
| `className` | `string` | — | Extra classes merged into the root element. |
| `linkTarget` | `string` | `'_blank'` | `target` for profile links. |
| `renderAvatar` | `(contributor, index) => ReactNode` | — | Replace one avatar. |
| `renderName` | `(contributor, index) => ReactNode` | — | Replace one name or link. |
| `renderContributor` | `(contributor, index) => ReactNode` | — | Fully replace the default avatar + name rendering. |

#### `LastUpdated`

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `date` | `string \| number \| Date` | — | Date to display. |
| `label` | `string` | `'Last updated on'` | Text rendered before the date. |
| `formatDate` | `(date: Date) => string` | deterministic `en-US` / UTC | Custom formatter. |
| `className` | `string` | — | Extra classes. |

#### `GitMetaFooter`

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `date` | `string \| number \| Date` | — | Route date. |
| `contributors` | `RouteContributor[]` | — | Route contributors. |
| `showContributors` | `boolean` | `true` | Render the contributor half. |
| `showLastUpdated` | `boolean` | `true` | Render the date half. |
| `maxContributors` | `number` | `5` | Maximum contributors before `+N`. |
| `labels` | `{ contributors?, lastUpdated? }` | — | Labels for both halves. |
| `formatDate` | `(date: Date) => string` | deterministic `en-US` / UTC | Custom formatter. |
| `className` | `string` | — | Root classes. |
| `contributorsClassName` | `string` | — | Classes for the contributors block. |
| `dateClassName` | `string` | — | Classes for the date. |
| `contributorClassNames` | `ContributorsClassNames` | — | Class slots forwarded to `Contributors`. |
| `contributorProps` | `Omit<ContributorsProps, ...>` | — | Remaining `Contributors` props, including render props. |

#### Custom footer example

```tsx title="theme/page-footer.tsx"
import { GitMetaFooter } from '@bdocs/plugin-git-meta/client'
import { useRoutes } from 'boltdocs/client'

export function PageFooter() {
  const { currentRoute } = useRoutes()

  return (
    <GitMetaFooter
      date={currentRoute?.lastUpdated}
      contributors={currentRoute?.contributors}
      maxContributors={5}
      labels={{ contributors: 'Contributors', lastUpdated: 'Updated' }}
      className="mt-16 border-t border-subtle pt-6"
      contributorClassNames={{ avatar: 'ring-2 ring-surface' }}
      contributorProps={{
        renderName: (contributor) => contributor.name.split(' ')[0],
      }}
    />
  )
}
```

#### Contributors only

```tsx
import { Contributors } from '@bdocs/plugin-git-meta/client'

<Contributors
  contributors={currentRoute?.contributors}
  max={3}
  size="md"
  classNames={{ link: 'font-medium' }}
/>
```

### Route data

`RouteContributor` is exported from `boltdocs` and `boltdocs/client`:

```ts
interface RouteContributor {
  name: string
  commits: number
  lastCommit?: string
  avatar?: string
  url?: string
  email?: string // only with includeEmail: true
}
```

### Performance

- One `git log` process per repository + docs directory + `HEAD`, shared by both plugins.
- The cache key includes `HEAD`, so a dev server picks up new commits without restarting and stale metadata is not reused.
- Only Markdown files are retained in memory; other files in the docs tree are ignored.
- Merge commits are skipped. Renames are not followed.

### CI and shallow clones

Shallow clones only expose the commits that were fetched. If you want complete last-updated dates and contributor lists in CI, fetch full history:

```yaml title=".github/workflows/deploy.yml"
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
```

Without full history the plugins still work; they simply see fewer commits, and `fallbackToMtime` can cover pages with no history.

### Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| No dates or contributors | The docs directory is not inside a git repository | Run the build from a checkout, or enable `fallbackToMtime`. |
| A new page has no metadata | The file has never been committed | Commit it, or use `fallbackToMtime` for the date. |
| Dates look older than expected | Squash merges collapse a PR into one commit | Fetch full history or accept the squash date. |
| Contributor missing | Bot filtering, `minCommits`, `excludeAuthors`, or `max` | Check the plugin options. |
| No avatar | The commit email is not a GitHub noreply address | Add a `profiles` entry. |
| Email shows up | `includeEmail: true` | Disable it if metadata is public. |
| Components not visible | `autoRender: false`, or a custom layout that does not use the footer | Render `Contributors` / `GitMetaFooter` yourself. |

### Development

This package is part of the Boltdocs monorepo:

```bash
pnpm --filter @bdocs/plugin-git-meta test
pnpm --filter @bdocs/plugin-git-meta build
```

Tests use real temporary git repositories, so they verify commit parsing, author aggregation, bot filtering, profiles, and component rendering instead of mocking git.

### License

MIT © Jesus Alcala

---

## Español

### ¿Qué es este paquete?

`@bdocs/plugin-git-meta` incluye dos plugins independientes:

| Plugin | Añade | Origen |
| :--- | :--- | :--- |
| `lastUpdatedPlugin()` | `route.lastUpdated` | Último commit no-merge que tocó la página |
| `contributorsPlugin()` | `route.contributors` | Autores de cada commit no-merge que tocó la página |

Ambos usan el hook de ciclo de vida `routes:resolved`, así que los metadatos llegan tanto a la tabla de rutas del SSG como al módulo de rutas del cliente. El pie de página por defecto muestra la fecha automáticamente, y `contributorsPlugin()` monta el componente exportado `Contributors` en el footer mediante el slot de cliente `page:footer:start`.

### ¿Por qué usarlo?

- **Sin mantener fechas a mano.** Las fechas y los autores salen del historial que ya mantienes.
- **Un escaneo, dos plugins.** El `git log` se parsea una vez por repositorio + directorio de docs + `HEAD` y se comparte entre ambos.
- **UI renderizada en servidor.** El slot del footer se importa de forma eager, así que los contribuidores aparecen en el HTML estático y no después de la hidratación.
- **Personalizable de verdad.** Todos los componentes aceptan class slots y render props; `autoRender: false` te deja controlar el layout por completo.
- **Privacidad por defecto.** Los emails de los contribuidores no se envían al cliente salvo que lo actives.

### Instalación

```bash
pnpm add @bdocs/plugin-git-meta
```

### Inicio rápido

```ts title="boltdocs.config.ts"
import { defineConfig } from 'boltdocs'
import {
  contributorsPlugin,
  lastUpdatedPlugin,
} from '@bdocs/plugin-git-meta'

export default defineConfig({
  plugins: [
    lastUpdatedPlugin({ fallbackToMtime: true }),
    contributorsPlugin({ max: 8 }),
  ],
})
```

Los dos plugins son opcionales e independientes. Registra solo el que necesites.

### Cómo funciona

```text
historial de git
   │
   ▼
un único `git log --name-only` (cacheado por repo + docsDir + HEAD)
   │
   ▼
hook routes:resolved
   ├── lastUpdatedPlugin  → route.lastUpdated
   └── contributorsPlugin → route.contributors
   │
   ▼
tabla de rutas del SSG + virtual:boltdocs-routes
   │
   ▼
footer de la página (slot `page:footer:start`) + fecha por defecto
```

Solo se tienen en cuenta commits **no-merge**. Las fechas son fechas de commit (`%cI`) normalizadas a ISO-8601. Los contribuidores se agrupan por email en minúsculas antes de la fusión opcional por nombre visible.

### Opciones de `lastUpdatedPlugin()`

| Opción | Tipo | Por defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `fallbackToMtime` | `boolean` | `false` | Usa la fecha de modificación del archivo cuando git no tiene historial para la página (archivo sin commit, clon superficial, página generada desde una fuente virtual). |
| `overrideFrontmatter` | `boolean` | `false` | Sustituye por la fecha de git un valor `lastUpdated` escrito como string o `Date` en el frontmatter. |
| `paths` | `string[]` | — | Solo procesa rutas que empiecen por alguno de estos prefijos. |
| `excludePaths` | `string[]` | — | Omite rutas que empiecen por alguno de estos prefijos. |

Precedencia de la fecha para cada página:

1. `lastUpdated` explícito en el frontmatter (`string` o `Date`), salvo que `overrideFrontmatter` esté activo.
2. Último commit no-merge de git que tocó el archivo.
3. Fecha de modificación del archivo, solo si `fallbackToMtime` está activo.
4. El valor existente de la ruta, sin tocar.

> Un `lastUpdated` numérico en el frontmatter es el fallback de mtime del core, no una fecha escrita por el autor, así que git puede reemplazarlo.

Ejemplo:

```ts
lastUpdatedPlugin({
  fallbackToMtime: true,
  excludePaths: ['/changelog'],
})
```

### Opciones de `contributorsPlugin()`

| Opción | Tipo | Por defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `max` | `number` | `12` | Máximo de contribuidores por página (1–100). |
| `order` | `'commits' \| 'recent'` | `'commits'` | Ordena por total de commits o por la contribución más reciente. |
| `excludeBots` | `boolean` | `true` | Descarta cuentas automáticas como dependabot, renovate, identidades `[bot]` y `copilot-swe-agent`. |
| `excludeAuthors` | `string[]` | `[]` | Nombres o emails a excluir. |
| `minCommits` | `number` | `1` | Ignora contribuidores por debajo de este número de commits. |
| `mergeByName` | `boolean` | `true` | Combina identidades que comparten el mismo nombre visible. |
| `includeEmail` | `boolean` | `false` | Incluye el email del autor en los metadatos de la ruta. |
| `autoRender` | `boolean` | `true` | Monta `Contributors` en el pie de página por defecto. |
| `profiles` | `Record<string, Profile>` | `{}` | Overrides por identidad, indexados por email o nombre visible. |
| `paths` | `string[]` | — | Solo procesa rutas que empiecen por alguno de estos prefijos. |
| `excludePaths` | `string[]` | — | Omite rutas que empiecen por alguno de estos prefijos. |

Un `Profile` acepta `name`, `avatar` y `url`; `avatar` y `url` deben ser URLs válidas.

#### Resolución de identidades

1. Busca `profiles[email]` y después `profiles[nombreVisible]` (sin distinguir mayúsculas).
2. Genera avatar y URL de perfil automáticamente para emails noreply de GitHub (`12345+usuario@users.noreply.github.com`).
3. Filtra bots y `excludeAuthors`.
4. Aplica `minCommits`.
5. Fusiona identidades con el mismo nombre visible si `mergeByName` está activo.
6. Ordena por commits (o recencia) y aplica `max`.

Ejemplo:

```ts
contributorsPlugin({
  max: 8,
  order: 'commits',
  profiles: {
    'jane@example.com': {
      name: 'Jane Doe',
      avatar: 'https://github.com/janedoe.png?size=64',
      url: 'https://github.com/janedoe',
    },
  },
  excludeAuthors: ['docs-bot@example.com'],
})
```

### Renderizado: footer automático

`contributorsPlugin()` registra el componente exportado `Contributors` en el slot `page:footer:start`. El layout por defecto lo muestra a la izquierda de la fecha de última actualización:

```text
┌──────────────────────────────────────────────────────────────┐
│ [avatares] Jesús Alcalá          Last updated on 3 mayo 2026 │
└──────────────────────────────────────────────────────────────┘
```

El registro de cliente generado importa el slot de forma eager, así que participa en SSR e hidratación. Desactiva el montaje automático si prefieres renderizar los componentes tú:

```ts
contributorsPlugin({ autoRender: false })
```

### Componentes

Importa siempre desde la entrada cliente, nunca desde la entrada node:

```tsx
import {
  Contributors,
  GitMetaFooter,
  LastUpdated,
} from '@bdocs/plugin-git-meta/client'
```

Son componentes de framework: dependen de React y del runtime cliente de Boltdocs (`useRoutes`, tokens del tema). La entrada node sigue sin dependencias más allá de `zod`.

#### `Contributors`

| Prop | Tipo | Por defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `contributors` | `RouteContributor[]` | — | Datos, normalmente `route.contributors`. |
| `max` | `number` | `5` | Contribuidores renderizados antes de colapsar en `+N`. |
| `size` | `'sm' \| 'md'` | `'sm'` | Preset de tamaño de avatares y texto. |
| `showAvatars` | `boolean` | `true` | Renderiza la pila de avatares. |
| `showNames` | `boolean` | `true` | Renderiza la lista de nombres. |
| `label` | `string` | `'Contributors'` | Etiqueta accesible del grupo. |
| `classNames` | `ContributorsClassNames` | — | Class slots: `root`, `avatars`, `avatar`, `names`, `name`, `link`, `trailing`. |
| `className` | `string` | — | Clases extra fusionadas en el elemento raíz. |
| `linkTarget` | `string` | `'_blank'` | `target` de los enlaces de perfil. |
| `renderAvatar` | `(contributor, index) => ReactNode` | — | Reemplaza un avatar. |
| `renderName` | `(contributor, index) => ReactNode` | — | Reemplaza un nombre o enlace. |
| `renderContributor` | `(contributor, index) => ReactNode` | — | Reemplaza por completo el render por defecto de avatar + nombre. |

#### `LastUpdated`

| Prop | Tipo | Por defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `date` | `string \| number \| Date` | — | Fecha a mostrar. |
| `label` | `string` | `'Last updated on'` | Texto renderizado antes de la fecha. |
| `formatDate` | `(date: Date) => string` | determinista `en-US` / UTC | Formateador personalizado. |
| `className` | `string` | — | Clases extra. |

#### `GitMetaFooter`

| Prop | Tipo | Por defecto | Descripción |
| :--- | :--- | :--- | :--- |
| `date` | `string \| number \| Date` | — | Fecha de la ruta. |
| `contributors` | `RouteContributor[]` | — | Contribuidores de la ruta. |
| `showContributors` | `boolean` | `true` | Renderiza la mitad de contribuidores. |
| `showLastUpdated` | `boolean` | `true` | Renderiza la mitad de la fecha. |
| `maxContributors` | `number` | `5` | Máximo de contribuidores antes de `+N`. |
| `labels` | `{ contributors?, lastUpdated? }` | — | Etiquetas para ambas mitades. |
| `formatDate` | `(date: Date) => string` | determinista `en-US` / UTC | Formateador personalizado. |
| `className` | `string` | — | Clases raíz. |
| `contributorsClassName` | `string` | — | Clases del bloque de contribuidores. |
| `dateClassName` | `string` | — | Clases de la fecha. |
| `contributorClassNames` | `ContributorsClassNames` | — | Class slots reenviados a `Contributors`. |
| `contributorProps` | `Omit<ContributorsProps, ...>` | — | Resto de props de `Contributors`, incluidas las render props. |

#### Ejemplo de footer personalizado

```tsx title="theme/page-footer.tsx"
import { GitMetaFooter } from '@bdocs/plugin-git-meta/client'
import { useRoutes } from 'boltdocs/client'

export function PageFooter() {
  const { currentRoute } = useRoutes()

  return (
    <GitMetaFooter
      date={currentRoute?.lastUpdated}
      contributors={currentRoute?.contributors}
      maxContributors={5}
      labels={{ contributors: 'Autores', lastUpdated: 'Actualizado el' }}
      className="mt-16 border-t border-subtle pt-6"
      contributorClassNames={{ avatar: 'ring-2 ring-surface' }}
      contributorProps={{
        renderName: (contributor) => contributor.name.split(' ')[0],
      }}
    />
  )
}
```

#### Solo contribuidores

```tsx
import { Contributors } from '@bdocs/plugin-git-meta/client'

<Contributors
  contributors={currentRoute?.contributors}
  max={3}
  size="md"
  classNames={{ link: 'font-medium' }}
/>
```

### Datos de la ruta

`RouteContributor` se exporta desde `boltdocs` y `boltdocs/client`:

```ts
interface RouteContributor {
  name: string
  commits: number
  lastCommit?: string
  avatar?: string
  url?: string
  email?: string // solo con includeEmail: true
}
```

### Rendimiento

- Un proceso `git log` por repositorio + directorio de docs + `HEAD`, compartido por ambos plugins.
- La clave de caché incluye `HEAD`, así que el servidor de desarrollo detecta commits nuevos sin reiniciar y no reutiliza metadatos obsoletos.
- Solo se retienen archivos Markdown en memoria; el resto del árbol de docs se ignora.
- Los commits merge se omiten. Los renombrados no se siguen.

### CI y clones superficiales

Los clones superficiales solo exponen los commits descargados. Si quieres fechas y contribuidores completos en CI, descarga el historial completo:

```yaml title=".github/workflows/deploy.yml"
- uses: actions/checkout@v4
  with:
    fetch-depth: 0
```

Sin historial completo los plugins siguen funcionando; simplemente ven menos commits, y `fallbackToMtime` puede cubrir las páginas sin historial.

### Solución de problemas

| Síntoma | Causa probable | Solución |
| :--- | :--- | :--- |
| No aparecen fechas ni contribuidores | El directorio de docs no está dentro de un repositorio git | Ejecuta el build desde un checkout o activa `fallbackToMtime`. |
| Una página nueva no tiene metadatos | El archivo nunca se ha commiteado | Haz commit, o usa `fallbackToMtime` para la fecha. |
| Las fechas son más antiguas de lo esperado | Un squash merge convierte el PR en un solo commit | Descarga el historial completo o acepta la fecha del squash. |
| Falta un contribuidor | Filtrado de bots, `minCommits`, `excludeAuthors` o `max` | Revisa las opciones del plugin. |
| No hay avatar | El email del commit no es noreply de GitHub | Añade una entrada en `profiles`. |
| Aparece el email | `includeEmail: true` | Desactívalo si los metadatos son públicos. |
| Los componentes no se ven | `autoRender: false` o un layout personalizado que no usa el footer | Renderiza `Contributors` / `GitMetaFooter` tú mismo. |

### Desarrollo

Este paquete forma parte del monorepo de Boltdocs:

```bash
pnpm --filter @bdocs/plugin-git-meta test
pnpm --filter @bdocs/plugin-git-meta build
```

Los tests usan repositorios git temporales reales, así que verifican el parseo de commits, la agregación de autores, el filtrado de bots, los perfiles y el renderizado de componentes en lugar de mockear git.

### Licencia

MIT © Jesus Alcala
