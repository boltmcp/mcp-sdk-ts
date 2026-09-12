---
name: open-pr
description: 'Commit changes to a new branch off custom and open a PR against origin/custom'
disable-model-invocation: true
---

1. If there are no uncommitted changes, tell the user and stop.

2. Create a branch from the latest `origin/custom`:
    - `git fetch origin custom`
    - `git checkout -b <descriptive-branch-name> origin/custom`

3. Stage relevant files by name, commit with a clear message, and push:
    - `git push -u origin <branch-name>`

4. Open a PR: `gh pr create --repo boltmcp/mcp-sdk-ts --base custom --title "<title>" --body "<summary>"`

5. Return the PR URL.
