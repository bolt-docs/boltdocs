# @bdocs/plugin-rss

## 2.0.3

### Patch Changes

- [`0dbf369`](https://github.com/bolt-docs/boltdocs/commit/0dbf3694198861ab8f81f740a3529da5944abb33) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix RSS feeds not being generated: generate feeds on the reliable `build:generate` pipeline hook (absolute `outDir` after SSG finalizes) instead of the client-build-only `afterBuild` hook, bucket default-locale routes (`locale: undefined`) into the default-locale feed so `rss-en.xml` is not empty, resolve a relative `ctx.outDir` against `ctx.rootDir` in the compatibility fallback, and detect the page locale from any path segment (not just the first) so translated docs under a shared base (`/docs/es/...`) get the correct `rss-es.xml` link.

- [`9c5251c`](https://github.com/bolt-docs/boltdocs/commit/9c5251c4fba6efee8d9d1920495be9c731bab8b2) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Add Shiki languages/themes and zod dependencies, and refresh build configs.

- Updated dependencies [[`8a5c519`](https://github.com/bolt-docs/boltdocs/commit/8a5c5195907b77825f364a8195cd0ae8554a69d6), [`6472b84`](https://github.com/bolt-docs/boltdocs/commit/6472b841ef18aa92033a0b64d8fd70281ce954dc), [`a33d512`](https://github.com/bolt-docs/boltdocs/commit/a33d512b965bcc701ed76e98db632dcf45fd8bd9), [`d07e49d`](https://github.com/bolt-docs/boltdocs/commit/d07e49d48ac2ab3f0ab289541b37610bd54247a8), [`dffb1d0`](https://github.com/bolt-docs/boltdocs/commit/dffb1d0c70b5da1ddf53484c1b43d0c141eacdad), [`33a4e4b`](https://github.com/bolt-docs/boltdocs/commit/33a4e4b6d7e95552e0f16228a045b41a02f82e33), [`36c959e`](https://github.com/bolt-docs/boltdocs/commit/36c959e922b491fa0e0de16f53be4dd6f894ba4b), [`9c5251c`](https://github.com/bolt-docs/boltdocs/commit/9c5251c4fba6efee8d9d1920495be9c731bab8b2), [`8a5c519`](https://github.com/bolt-docs/boltdocs/commit/8a5c5195907b77825f364a8195cd0ae8554a69d6)]:
  - boltdocs@3.3.0

## 2.0.2

### Patch Changes

- Updated dependencies []:
  - boltdocs@3.2.2

## 2.0.1

### Patch Changes

- Updated dependencies [[`4a94958`](https://github.com/bolt-docs/boltdocs/commit/4a94958e480398346001a66d866ecce33d69c5e9)]:
  - boltdocs@3.2.1

## 2.0.0

### Patch Changes

- Updated dependencies [[`6904710`](https://github.com/bolt-docs/boltdocs/commit/6904710df233ff29193adcbb746c4d16011255d3), [`2bc1045`](https://github.com/bolt-docs/boltdocs/commit/2bc104567acf2788465fdeb84f0e37d9ad18bd4a), [`64fe83a`](https://github.com/bolt-docs/boltdocs/commit/64fe83a2fc1b241f39ac7032bb38c7439041508c), [`46e288d`](https://github.com/bolt-docs/boltdocs/commit/46e288d485bf50ae226a3b3c70c0a93040b8ae0c), [`2bc1045`](https://github.com/bolt-docs/boltdocs/commit/2bc104567acf2788465fdeb84f0e37d9ad18bd4a), [`2bc1045`](https://github.com/bolt-docs/boltdocs/commit/2bc104567acf2788465fdeb84f0e37d9ad18bd4a), [`2bc1045`](https://github.com/bolt-docs/boltdocs/commit/2bc104567acf2788465fdeb84f0e37d9ad18bd4a)]:
  - boltdocs@3.2.0

## 1.0.0

### Patch Changes

- Updated dependencies [[`ed84f8a`](https://github.com/bolt-docs/boltdocs/commit/ed84f8af1809ae7b33ad4e6cd6468786dd19a947)]:
  - boltdocs@3.1.0
