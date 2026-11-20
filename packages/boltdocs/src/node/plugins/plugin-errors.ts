export class PluginError extends Error {
  override name = this.constructor.name

  constructor(
    public readonly pluginName: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(`[plugin:${pluginName}] ${message}`, options)
  }
}

export class PluginValidationError extends PluginError {
  constructor(pluginName: string, message: string) {
    super(pluginName, `Validation failed: ${message}`)
  }
}

export class PluginCompatibilityError extends PluginError {
  constructor(pluginName: string, message: string) {
    super(pluginName, `Compatibility error: ${message}`)
  }
}

export class PluginHookError extends PluginError {
  constructor(
    pluginName: string,
    public readonly hookName: string,
    originalError: Error,
  ) {
    super(pluginName, `Error in hook '${hookName}': ${originalError.message}`, {
      cause: originalError,
    })
  }
}
