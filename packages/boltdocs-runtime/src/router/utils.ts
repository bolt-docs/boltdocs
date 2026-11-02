export function normalizeBasename(basename?: string): string {
  if (!basename || basename === '/') return '/'
  return basename.replace(/\/$/, '') || '/'
}

export function hasBasename(path: string, basename: string): boolean {
  const normalized = normalizeBasename(basename)
  if (normalized === '/') return true
  if (path === normalized) return true
  return path.startsWith(`${normalized}/`)
}

export function stripBasename(path: string, basename: string): string {
  const normalized = normalizeBasename(basename)
  if (normalized === '/') return path
  if (!hasBasename(path, normalized)) return path
  const stripped = path.slice(normalized.length)
  return stripped.startsWith('/') ? stripped : `/${stripped}`
}

export function addBasename(path: string, basename: string): string {
  const normalized = normalizeBasename(basename)
  if (normalized === '/') return path
  if (hasBasename(path, normalized)) return path
  if (path.startsWith('/')) {
    return `${normalized}${path}`
  }
  return `${normalized}/${path}`
}
