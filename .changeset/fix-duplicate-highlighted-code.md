---
'@bdocs/processor-satteri': patch
---

Stop shipping every highlighted code block twice to the browser.

The Shiki rehype plugin attached the serialized HTML as `data-highlighted-html` and also left the HAST children on the node. The MDX compiler turns both into output, so every code block reached the client twice: once as an HTML string and once as a React tree.

The tree was dead weight. `CodeBlockPre` renders `data-highlighted-html` through `dangerouslySetInnerHTML` and ignores children entirely; the copy button and the expand/collapse logic both read the rendered DOM via `preRef.current.textContent`, not the children.

Children are now emitted only when serialization fails, which is the one case where the JSX path is the only rendering route. On the 263-page docs site this removed all 11,539 duplicate React code-block nodes and cut the JavaScript delivered per visit from 2440 KB to 1907 KB (-22%), and the total built client from 8310 KB to 5672 KB.
