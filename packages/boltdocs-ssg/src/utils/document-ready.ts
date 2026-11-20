export function documentReady<T>(_passThrough?: T): Promise<T | undefined> {
  if (document.readyState === 'loading') {
    return new Promise((resolve) => {
      document.addEventListener('DOMContentLoaded', () => resolve(_passThrough))
    })
  }

  return Promise.resolve(_passThrough)
}
