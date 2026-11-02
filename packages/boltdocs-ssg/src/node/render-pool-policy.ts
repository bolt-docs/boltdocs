/**
 * Decide whether a render pool should be started before route cache checks.
 *
 * Cold builds benefit from eager worker startup because it overlaps SSR worker
 * imports with manifest preparation. Builds with a reusable client cache defer
 * startup until the first uncached route is found; incremental builds often
 * render only one page and should not initialize the full pool speculatively.
 */
export function shouldEagerlyCreateRenderPool(
  routeCount: number,
  canBypassClientBuild: boolean,
): boolean {
  return routeCount > 4 && !canBypassClientBuild
}
