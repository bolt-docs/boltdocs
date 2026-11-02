import type { PluginStore } from './plugin-types'

/**
 * Implementation of the shared plugin store.
 * Uses a namespaced approach to prevent key collisions between plugins.
 */
export class BoltdocsPluginStore implements PluginStore {
  private data = new Map<string, unknown>()

  /**
   * Internal helper to create a namespaced key.
   */
  private getNamespaceKey(pluginName: string, key: string): string {
    return `${pluginName}:${key}`
  }

  /**
   * Retrieves a value from the store. Returns a deep clone to prevent mutations (side-effects).
   */
  public get<T = unknown>(pluginName: string, key: string): T | undefined {
    const nsKey = this.getNamespaceKey(pluginName, key)
    const value = this.data.get(nsKey)

    if (value === undefined) return undefined

    // For safety, return a deep clone if it's an object
    if (typeof value === 'object' && value !== null) {
      return JSON.parse(JSON.stringify(value)) as T
    }

    return value as T
  }

  /**
   * Stores a value in the store. Key is automatically namespaced.
   */
  public set(pluginName: string, key: string, value: unknown): void {
    const nsKey = this.getNamespaceKey(pluginName, key)
    // We also store a clone to ensure the store state is immutable from the outside
    const storedValue =
      typeof value === 'object' && value !== null
        ? JSON.parse(JSON.stringify(value))
        : value

    this.data.set(nsKey, storedValue)
  }

  /**
   * Checks for the existence of a key in the store.
   */
  public has(pluginName: string, key: string): boolean {
    const nsKey = this.getNamespaceKey(pluginName, key)
    return this.data.has(nsKey)
  }
}
