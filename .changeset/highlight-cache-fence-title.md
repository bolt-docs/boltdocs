---
'@bdocs/processor-satteri': patch
---

A code block keeps its own fence title, whichever page was compiled first.

The highlight cache is keyed by the language, the resolved options and the
code. The resolved options carry the fence meta — the title, the line numbers,
the word wrap — but the meta's properties are defined as non-enumerable, so
`JSON.stringify` dropped them. Two blocks with the same code and a different
title therefore shared one cache entry, and the first one to be compiled lent
its title to the other.

Which title a page showed depended on the order the pages were compiled in.
The documentation site compiled the same page in two ways — on the main thread
and in a build worker — and the two produced different titles for six code
blocks out of three thousand.

The cache key carries the fence meta now, so an entry is only reused for a
block that renders the same.

Two smaller fixes travel with it. A grammar can include another one, and the
inclusion only resolves if the included grammar is loaded: the Markdown
grammar includes the YAML grammar to highlight a leading `---` block as front
matter, and whether that resolved used to depend on whether some other page
happened to use YAML first. And the fence meta is now read from the copy
Sätteri fills in itself, which does not compete with the other visitors of
the same node.
