---
description: Analyze modifications and suggest/generate a changeset
agent: plan
---

Git Diff:
!`git diff`

Identify the modified files, map them to packages if in a monorepo, suggest the appropriate version bump (major/minor/patch), and write a concise, user-friendly release notes description.
Write the response in standard Changeset markdown format:
```markdown
---
"package-name": bump-type
---

Your description of changes.
```
