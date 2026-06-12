import type { Config as SVGOConfig } from 'svgo'
import type {
  PngOptions,
  JpegOptions,
  TiffOptions,
  GifOptions,
  WebpOptions,
  AvifOptions,
} from 'sharp'

export const VITE_PLUGIN_NAME = 'vite-plugin-image-optimizer'
export const PLUGIN_VERSION = '0.1.0'
export const TEST_REGEX = /\.(jpe?g|png|gif|tiff|webp|svg|avif)$/i

export const DEFAULT_OPTIONS = {
  logStats: true,
  includePublic: true,
  include: undefined as RegExp | string | string[] | undefined,
  exclude: undefined as RegExp | string | string[] | undefined,
  test: TEST_REGEX,
  png: { quality: 80, compressionLevel: 9 } as PngOptions,
  jpeg: { quality: 80, mozjpeg: true } as JpegOptions,
  jpg: { quality: 80, mozjpeg: true } as JpegOptions,
  tiff: { quality: 80 } as TiffOptions,
  gif: {} as GifOptions,
  webp: { quality: 75 } as WebpOptions,
  avif: { quality: 60 } as AvifOptions,
  svg: {
    multipass: true,
    plugins: [{ name: 'preset-default' }],
  } as SVGOConfig,
}
