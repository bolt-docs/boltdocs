# Visual regression harness

Compares the rendered docs site against itself, across builds. Built for one job:
prove that moving a component from Tailwind utilities to plain CSS did not change
what a visitor sees.

The docs site is the only thing in this repository that renders the theme, so it
is the only place a conversion can be checked honestly.

## Commands

```bash
# Build the site first; the harness serves docs/dist as a real deployment would.
cd docs && pnpm exec boltdocs build && cd ..

node scripts/visual/snapshot.mjs capture <label>            # 914 images, 36 pages
node scripts/visual/snapshot.mjs capture <label> --quick    # 92 images, 4 pages
node scripts/visual/snapshot.mjs diff <a> <b>

node scripts/visual/styles.mjs <label>
node scripts/visual/styles.mjs compare <a> <b>
```

`why.mjs` takes a URL and a selector and reports which rule won and why:

```bash
node scripts/visual/why.mjs /docs/guides/getting-started/installation.html 'a[href="/x"]' color
```

## Determinism, and what it cost

A harness that disagrees with itself is worse than none, because it reports green.
Three things had to be fixed before the output could be believed, and each is a
trap worth knowing about:

- **External requests are blocked.** The docs load Geist and KaTeX from CDNs. A
  network hiccup is otherwise indistinguishable from a styling regression.
- **The DOM is allowed to settle.** The navbar's search button mounts after
  hydration. Screenshotting on `load` caught a coin flip, and the navbar came out
  a different width run to run — half the baseline disagreed with itself by 22%.
- **Each scroll position is captured.** The shell is `height: 100vh; overflow:
  hidden`, so the document never scrolls and `fullPage` returns one viewport,
  silently. The scrolling element is an inner `<main>`, 3292px of content in a
  900px window. Deleting a card's `padding` produced a zero-difference run
  against a `fullPage` harness: 144 screenshots of a page whose lower half had
  never been recorded.

## The server 404s, on purpose

An earlier version resolved a missing file to `index.html`. Nothing errored, and
the suite reported "144 screenshots, 0 differences" while photographing the
homepage 144 times. A miss is now a 404, and every page asserts the rendered
`h1` matches the file it was asked for.

## References

`original-ui` is the build before any conversion (`76283637`). `native*` are
successive attempts. Comparing a conversion against `HEAD` measures nothing: that
commit already had pagination converted but no stylesheet loaded, so the cards
were unstyled and the baseline recorded the regression as the truth.
