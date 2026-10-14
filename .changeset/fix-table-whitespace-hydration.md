---
'@bdocs/processor-satteri': patch
---

Drop whitespace-only text nodes inside table sections during MDX compilation

The compiler preserved the newlines that separate table rows and cells and
emitted them as text children of `<tbody>` and `<tr>`. React rejects that
outright: during server rendering the whitespace is written into the HTML, and
by the time the client hydrates the browser's parser has already discarded
those text nodes while building the table, so the two sides disagree and React
discards the whole page (error #418).

The fix removes the whitespace from the HAST rather than from the component
layer, so it also applies to user-supplied mappings of the table elements.
