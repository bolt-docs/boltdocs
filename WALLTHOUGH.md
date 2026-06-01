# Docs notes

## `collections.postsPerPage` config
Nuevo campo opcional en `BoltdocsConfig`:
```ts
interface BoltdocsCollectionsConfig {
  postsPerPage?: number  // default: 10
}
```
Afecta paginación de colecciones (blog, etc.). Se pasa desde `buildCollectionRoutes`.

## createRoutes refactor — nueva estructura de archivos
`create-routes.tsx` ahora es un orchestrator (~45 líneas) que delega en:

| Archivo | Responsabilidad |
|---|---|
| `create-routes.doc.tsx` | `buildDocRoutes` — rutas de documentación + fallbacks version/locale |
| `create-routes.external.tsx` | `buildExternalRoutes` — páginas externas (/, /about) con i18n |
| `create-routes.collection.tsx` | `buildCollectionRoutes` — colecciones ([blog]) con paginación |
| `mdx-elements.tsx` | `LazyMdxElement`, `EagerMdxElement`, `NotFoundWrapper`, `resolveModuleLoader` |
| `create-routes.utils.ts` | `withBase`, `buildModuleMap` |

## `Layout` removido de `CreateRoutesOptions`
Era dead code: se pasaba desde entry.ts pero `createRoutes` jamás lo usaba (DocsLayout importa `virtual:boltdocs-layout` directamente). Breaking change si alguien dependía de ese prop.

## Paginación movida fuera del router
`buildCollectionRoutes` acepta `postsPerPage` como parámetro. El router ya no hardcodea `POSTS_PER_PAGE = 10`.

## i18n/versions extraído a `buildDocRoutes`
La lógica de permutación de versiones y locales para fallback redirects está encapsulada en `buildDocRoutes`, no en el orchestrator.

## Refactor del Plugin System (Mayo 2026)

Se simplificó el sistema de plugins eliminando el sistema de permisos y reestructurando hooks.

### Cambios principales:
1. **Permisos eliminados completamente**: Se removió `PluginPermission`, `PluginPermissionSchema`, `permissions` de `BoltdocsPluginSchema` y `SecureBoltdocsPlugin`.
2. **Hooks reducidos a 7**: `beforeBuild`, `afterBuild`, `buildEnd`, `beforeDev`, `afterDev`, `transformMdx`, `transformHtml`.
3. **`configResolved` removido**: Ya no se ejecuta hook de configuración resuelta.
4. **Transform hooks con chain pattern**: `transformMdx` y `transformHtml` usan `PluginLifecycleManager.runChain()` — la salida de un plugin alimenta la entrada del siguiente.
5. **`MDX_NODES` movido** de `plugins/plugin-constants.ts` a `mdx/constants.ts`.
6. **`plugin-constants.ts` eliminado**.
7. **`boltdocsMdxPlugin` incluido dentro de `boltdocsPlugin`**: Ya no se agrega por separado en `createViteConfig` ni en `boltdocs()`. Esto evita compilación MDX duplicada y le da acceso al lifecycle manager.

### Archivos afectados:
- `src/node/plugins/plugin-types.ts` — tipos simplificados
- `src/node/plugins/plugin-lifecycle.ts` — nuevo método `runChain()`
- `src/node/plugins/plugin-validator.ts` — sin validación de permisos
- `src/node/plugins/plugin-constants.ts` — ELIMINADO
- `src/node/mdx/constants.ts` — ahora define MDX_NODES
- `src/node/mdx/index.ts` — acepta `getLifecycle`, llama `runChain('transformMdx')`
- `src/node/plugin/index.ts` — incluye `boltdocsMdxPlugin`
- `src/node/schema/config.ts` — sin PluginPermissionSchema
- `src/shared/types.ts` — sin PluginPermission
- `src/node/index.ts` — sin llamada separada a `boltdocsMdxPlugin`
- `tests/plugins/` — tests divididos en 5 archivos por módulo

## Re-arquitectura de Seguridad en Plugins (A redocumentar en docs oficiales)

Se eliminó por completo el sandbox dinámico y el sistema de declaración de permisos (`permissions`), ya que resultaban complejos e ineficientes. En su lugar, se implementó un modelo de seguridad basado en prevención y auditoría estática.

### Puntos a actualizar en la documentación oficial:

1. **Guía de Plugins / Configuración (`boltdocs.config.ts`)**:
   - **Remoción de Permisos**: Indicar que la propiedad `permissions` ya no es requerida ni procesada. Los plugins tienen acceso nativo a sus hooks del ciclo de vida de forma transparente.
   - **Mejores Prácticas**: Fomentar la simplicidad en el desarrollo de plugins al no requerir configuraciones de sandbox adicionales.

2. **Sección de Seguridad de la Plataforma**:
   - **El Parche Quirúrgico de FS**: Documentar que Boltdocs intercepta automáticamente las operaciones de escritura y borrado de archivos (`fs` y `fs/promises`). Cualquier intento de un plugin de escribir o borrar fuera de la raíz del proyecto, o de modificar archivos `.env` o la carpeta `node_modules` (con excepción del caché `.vite`), arrojará un error de seguridad inmediato y abortará el proceso.
   - **Advertencias de Scripts Nativos**: Al iniciar `boltdocs dev` o `boltdocs build`, se analizan los `package.json` de los plugins instalados. Si alguno ejecuta scripts de `preinstall`, `postinstall` o `install`, se mostrará una advertencia amarilla en consola para que el desarrollador esté al tanto.

3. **Referencia de CLI (`cli.mdx`)**:
   - **Comando `boltdocs audit`**: Documentar este nuevo comando. Explicar que realiza un análisis estático de código en los archivos fuentes de los plugins buscando llamadas de red (`fetch(`, `axios`, `http.request`, `https.request`) o accesos directos a variables de entorno (`process.env`). Muestra una tabla con el estado de cada plugin (`Clean` o `Warning`) para dar visibilidad total antes de la compilación final.
