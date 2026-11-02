# @bdocs/plugin-image-optimizer

Optimize images at build time with Sharp.js and SVGO. Plugin for Vite/Boltdocs.

## Features

- Parallel processing via worker threads (up to CPU count - 1)
- Persistent caching with Boltdocs' `AssetCache`
- DUI-powered stats table with per-file savings
- Zero-copy buffer transfer between threads
- Backpressure fallback when queue exceeds 500 tasks

## Installation

```console
pnpm add @bdocs/plugin-image-optimizer
```

`sharp` and `svgo` are peer dependencies — install only what you need:

```console
pnpm add sharp svgo --save-dev
```

## Usage

```ts
import { ViteImageOptimizer } from '@bdocs/plugin-image-optimizer'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [ViteImageOptimizer()],
})
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `test` | `RegExp` | `/\.(jpe?g\|png\|gif\|tiff\|webp\|svg\|avif)$/i` | Match files to process |
| `include` | `RegExp \| string \| string[]` | — | Overrides `test`/`exclude` |
| `exclude` | `RegExp \| string \| string[]` | — | Files to skip |
| `includePublic` | `boolean` | `true` | Optimize files in `publicDir` |
| `logStats` | `boolean` | `true` | Print optimization table after build |
| `svg` | `SVGOConfig` | preset-default (lossless) | [SVGO config](https://github.com/svg/svgo) |
| `png` | `PngOptions` | `{ quality: 85 }` | [Sharp PNG](https://sharp.pixelplumbing.com/api-output#png) |
| `jpeg` | `JpegOptions` | `{ quality: 85 }` | [Sharp JPEG](https://sharp.pixelplumbing.com/api-output#jpeg) |
| `jpg` | `JpegOptions` | `{ quality: 85 }` | Alias for jpeg |
| `tiff` | `TiffOptions` | `{ quality: 85 }` | [Sharp TIFF](https://sharp.pixelplumbing.com/api-output#tiff) |
| `gif` | `GifOptions` | `{}` | [Sharp GIF](https://sharp.pixelplumbing.com/api-output#gif) |
| `webp` | `WebpOptions` | `{ quality: 85 }` | [Sharp WebP](https://sharp.pixelplumbing.com/api-output#webp) |
| `avif` | `AvifOptions` | `{ quality: 80 }` | [Sharp AVIF](https://sharp.pixelplumbing.com/api-output#avif) |

## License

MIT
