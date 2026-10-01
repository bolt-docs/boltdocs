# @bdocs/plugin-math

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
