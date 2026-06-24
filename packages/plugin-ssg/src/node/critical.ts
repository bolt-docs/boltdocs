import type Beasties from 'beasties'
import type { Options } from 'beasties'

export async function getBeasties(
  outDir: string,
  options: Options = {},
): Promise<Beasties | undefined> {
  try {
    const mod = await import('beasties')
    const BeastiesClass = mod.default || mod
    return new BeastiesClass({
      path: outDir,
      logLevel: 'warn',
      external: true,
      inlineFonts: true,
      preloadFonts: true,
      ...options,
    })
  } catch (e) {
    return undefined
  }
}

export interface ZigCritters {
  processHtml(html: string, css: string): Promise<string>
}

export async function getZigCritters(): Promise<ZigCritters | undefined> {
  try {
    const mod = await import('@bdocs/zig-critters')
    const processHtml = mod.processHtml || mod.default?.processHtml
    if (!processHtml) return undefined
    return { processHtml }
  } catch (e) {
    return undefined
  }
}
