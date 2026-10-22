---
'@bdocs/plugin-mermaid': minor
'@bdocs/contracts': minor
'@bdocs/processor-satteri': minor
---

A user plugin's MDX hook can be rebuilt in a build worker, so a site with one keeps its parallel MDX compile.

A remark or rehype plugin is a function, and a function cannot cross a worker
boundary. A site with such a plugin therefore compiled its MDX on the main
thread, one page at a time, while the rest of the machine waited. On the
documentation site — 234 pages, with the Mermaid plugin transforming code
blocks — that was 6.4 s of the build on one core.

A plugin can now declare the same hook for a worker:

```ts
export default function mermaidPlugin(options: MermaidPluginOptions = {}) {
  return {
    name: 'boltdocs-plugin-mermaid',
    remarkPlugins: [[remarkMermaid, remarkOptions]],
    workerHooks: {
      remark: [
        {
          module: '@bdocs/plugin-mermaid',
          export: 'remarkMermaid',
          options: remarkOptions,
          kind: 'code',
          language: 'mermaid',
          component: 'Mermaid',
        },
      ],
    },
  }
}
```

The worker imports the module from the project — the way the site's own code
resolves it — and calls the export to obtain the same plugin. The compiled
pages are byte for byte identical to the ones the main thread compiles: the
same 253 pages, compared file by file.

The pool is used only when every user plugin that has an in-process hook also
declares a worker hook. A plugin that does not is left to the main thread,
because a worker that could not reproduce it would compile pages differently
from the main thread, and the output would depend on which worker compiled
which page.

`options` crosses the boundary by structured clone, so it holds data rather
than functions. A plugin that needs a function at runtime keeps its
in-process hook and does not declare a worker hook.

The pool is also smaller than it was: each worker loads the site's grammars
for itself, so past four workers the duplicated warm-up costs more than the
parallelism buys. Measured on the documentation site, four workers compile the
234 pages in 5.4 s and eight in 8.4 s, while a single thread takes 6.4 s.

| | Before | After |
| --- | --- | --- |
| MDX precompile | 6.4 s | **5.4 s** |
| Cold build | 20.8 s | **19.7 s** |
