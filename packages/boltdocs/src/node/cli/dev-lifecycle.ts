export interface DevShutdownController {
  shutdown(exitCode?: number): Promise<void>
  isShuttingDown(): boolean
}

export function createDevShutdownController(
  closeServer: () => Promise<void>,
  reset: () => void,
  exit: (code: number) => void = (code) => process.exit(code),
): DevShutdownController {
  let shuttingDown = false

  return {
    async shutdown(exitCode?: number): Promise<void> {
      if (shuttingDown) return
      shuttingDown = true
      try {
        await closeServer()
      } finally {
        reset()
        if (exitCode !== undefined) exit(exitCode)
      }
    },
    isShuttingDown(): boolean {
      return shuttingDown
    },
  }
}
