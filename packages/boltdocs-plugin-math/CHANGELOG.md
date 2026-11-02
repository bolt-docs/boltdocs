# @bdocs/plugin-math

## 4.0.4

### Patch Changes

- [`1d62dac`](https://github.com/bolt-docs/boltdocs/commit/1d62dac2bc237a919df6a89d5ebf7c94a94f742b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Maintenance fixes shipped alongside the Boltdocs 3.4.0 release line.

- Updated dependencies [[`f0a7586`](https://github.com/bolt-docs/boltdocs/commit/f0a75864646c3752c4ea258e2890ecc31717aa9f), [`f6235ac`](https://github.com/bolt-docs/boltdocs/commit/f6235ac3559a7bc0f05ab053b1b630e01d978986), [`05d8ddc`](https://github.com/bolt-docs/boltdocs/commit/05d8ddc432f804b0fdc8f5c5db4ac8090c92a2d8), [`d7f19fb`](https://github.com/bolt-docs/boltdocs/commit/d7f19fb48d280a760acf75d26f2bfa728e5e2a60), [`c38766b`](https://github.com/bolt-docs/boltdocs/commit/c38766b3fb1fdd1e45578bd3cb3d31c699cf4a30), [`e203fcb`](https://github.com/bolt-docs/boltdocs/commit/e203fcbce495f96f66594e33ea21c2e430e9fde1), [`24e3607`](https://github.com/bolt-docs/boltdocs/commit/24e36071381699e8112123935243e82e641c6728), [`147d39f`](https://github.com/bolt-docs/boltdocs/commit/147d39fb2e23c575b92cfa281869fffa50221a50), [`7841b09`](https://github.com/bolt-docs/boltdocs/commit/7841b0979f4cd60d70829bd9d6c5feb332dc8e12), [`e7b213c`](https://github.com/bolt-docs/boltdocs/commit/e7b213cfd4a0c3b6232a79e8861e2215f0b4bd09), [`1d62dac`](https://github.com/bolt-docs/boltdocs/commit/1d62dac2bc237a919df6a89d5ebf7c94a94f742b)]:
  - boltdocs@3.4.0

## 4.0.3

### Patch Changes

- [`8cbd78e`](https://github.com/bolt-docs/boltdocs/commit/8cbd78ee2ee8dc28f4f0ca80711235ce019e5227) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Entry bundle diet: KaTeX baked at build time, FlexSearch loaded on demand
  - The math plugin's `transformSource` hook now renders TeX with KaTeX during
    the build and emits `<BlockMath html={...}>` / `<MathComponent html={...}>`
    carrying the pre-rendered HTML. Client math components render the baked
    `html` synchronously; direct MDX usage without the bake falls back to an
    on-demand `import('katex')` (raw TeX stays visible until it resolves, so
    SSR and the first client render agree). The ~250 KB of KaTeX no longer
    ships in the entry bundle of every page.
  - FlexSearch is imported dynamically when the search dialog opens instead of
    statically at startup (~49 KB out of the entry).
  - Measured on the docs site: entry chunk 1,023 KB → 718 KB raw (266 → 172 KB
    gzipped, −35%); KaTeX and FlexSearch now load as on-demand chunks.

- Updated dependencies [[`8cbd78e`](https://github.com/bolt-docs/boltdocs/commit/8cbd78ee2ee8dc28f4f0ca80711235ce019e5227), [`f05a7d2`](https://github.com/bolt-docs/boltdocs/commit/f05a7d20bd76ccf59eb79bdb98c630f1c610cf77), [`b8e272f`](https://github.com/bolt-docs/boltdocs/commit/b8e272f532c298606539dafb4fe10945a080bc42)]:
  - boltdocs@3.3.5

## 4.0.2

### Patch Changes

- Updated dependencies []:
  - boltdocs@3.2.2

## 4.0.1

### Patch Changes

- Updated dependencies [[`4a94958`](https://github.com/bolt-docs/boltdocs/commit/4a94958e480398346001a66d866ecce33d69c5e9)]:
  - boltdocs@3.2.1

## 4.0.0

### Patch Changes

- Updated dependencies [[`6904710`](https://github.com/bolt-docs/boltdocs/commit/6904710df233ff29193adcbb746c4d16011255d3), [`2bc1045`](https://github.com/bolt-docs/boltdocs/commit/2bc104567acf2788465fdeb84f0e37d9ad18bd4a), [`64fe83a`](https://github.com/bolt-docs/boltdocs/commit/64fe83a2fc1b241f39ac7032bb38c7439041508c), [`46e288d`](https://github.com/bolt-docs/boltdocs/commit/46e288d485bf50ae226a3b3c70c0a93040b8ae0c), [`2bc1045`](https://github.com/bolt-docs/boltdocs/commit/2bc104567acf2788465fdeb84f0e37d9ad18bd4a), [`2bc1045`](https://github.com/bolt-docs/boltdocs/commit/2bc104567acf2788465fdeb84f0e37d9ad18bd4a), [`2bc1045`](https://github.com/bolt-docs/boltdocs/commit/2bc104567acf2788465fdeb84f0e37d9ad18bd4a)]:
  - boltdocs@3.2.0

## 3.0.0

### Patch Changes

- Updated dependencies [[`ed84f8a`](https://github.com/bolt-docs/boltdocs/commit/ed84f8af1809ae7b33ad4e6cd6468786dd19a947)]:
  - boltdocs@3.1.0

## 2.0.2

### Patch Changes

- Updated dependencies [[`2b98bc8`](https://github.com/bolt-docs/boltdocs/commit/2b98bc8c0dc12fe37d8889c15c219cfdea84406a), [`e5225e5`](https://github.com/bolt-docs/boltdocs/commit/e5225e5678b8e046dadb745010becf9bf652973e)]:
  - boltdocs@3.0.2

## 2.0.1

### Patch Changes

- Updated dependencies []:
  - boltdocs@3.0.1

## 2.0.0

### Patch Changes

- Updated dependencies [[`3cc3b45`](https://github.com/bolt-docs/boltdocs/commit/3cc3b451e59f533910b11fe69452f6d2720a2f0d), [`bbd7954`](https://github.com/bolt-docs/boltdocs/commit/bbd79543b8a8dbe17695c68e1791a2e38607ab9c)]:
  - boltdocs@3.0.0

## 1.0.3

### Patch Changes

- Updated dependencies [[`05d3cad`](https://github.com/bolt-docs/boltdocs/commit/05d3cad0d8ba4fbe3f5f0b18babfc0642b3aa082)]:
  - boltdocs@2.9.3

## 1.0.2

### Patch Changes

- Updated dependencies [[`8dec178`](https://github.com/bolt-docs/boltdocs/commit/8dec1783eb1c17f60e4cd3a2a69992b1745d2b6b)]:
  - boltdocs@2.9.2

## 1.0.1

### Patch Changes

- Updated dependencies [[`85cf6ba`](https://github.com/bolt-docs/boltdocs/commit/85cf6baf7dcfd2bee3952d44f250d309bb955fea)]:
  - boltdocs@2.9.1

## 1.0.0

### Patch Changes

- Updated dependencies [[`b819f24`](https://github.com/bolt-docs/boltdocs/commit/b819f240fa420d873db0e0f3ff0443e6ff1a3e7b)]:
  - boltdocs@2.9.0
