/**
 * Vite's HMR surface, which the runtime only touches in development.
 *
 * Declared locally rather than referencing `vite/client`, because this package
 * is not allowed a build-time dependency. `ImportMeta.hot` is the one place the
 * runtime asks about the dev server, and it is a type — nothing from Vite is
 * imported at runtime.
 *
 * The payload parameter is `never` rather than `any`, matching Vite's real shape
 * closely enough without importing the banned type into the codebase: a handler
 * that declares a concrete payload type stays assignable, because `never` is
 * assignable to every type. `any` here would have silenced the very thing these
 * declarations exist to check.
 */
interface ImportMeta {
  readonly hot?: {
    accept(cb?: (module: unknown) => void): void
    dispose(cb: () => void): void
    on(event: string, cb: (payload: never) => void): void
    off(event: string, cb: (payload: never) => void): void
    data: Record<string, unknown>
  }
}
