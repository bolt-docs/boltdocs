import type { UserConfig, UserConfigExport } from 'tsdown'

export const licenseBanner = `/**
 * Boltdocs - https://boltdocs.vercel.app
 * Copyright (c) 2026 Jesus Alcala
 * Licensed under the MIT License.
 */`

export const packageDefaults = {
  dts: true,
  clean: true,
  tsconfig: './tsconfig.json',
} as const

export function packageConfig(config: UserConfig): UserConfig {
  return {
    ...packageDefaults,
    ...config,
  }
}

export function defineConfig(config: UserConfigExport): UserConfigExport {
  return config
}
