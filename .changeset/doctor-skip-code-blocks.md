---
'boltdocs': patch
---

Fix false positive "broken internal link" reports for URLs inside fenced code blocks and inline code in the `boltdocs doctor` command. The link checker now strips code block content before scanning for links, preventing demo/example code from being treated as actual broken links.
