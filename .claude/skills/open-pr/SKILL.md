---
name: open-pr
description: 'Commit changes to a new branch off custom and open a PR against origin/custom'
---

1. Ensure the working tree has changes to commit (staged or unstaged). If there are no changes, tell the user and stop.

2. Ask the user for a branch name if they haven't provided one. The branch should be descriptive (e.g., `fix-auth-timeout`, `add-tag-releases`).

3. Ensure you're starting from an up-to-date `custom` branch:
    - `git fetch origin custom`
    - If currently on a feature branch with uncommitted changes, stash them first.
    - Create the new branch from `origin/custom`: `git checkout -b <branch-name> origin/custom`
    - If you stashed, pop the stash.

4. Stage and commit the changes:
    - Stage relevant files by name (avoid `git add -A` or `git add .`).
    - Write a clear commit message following the repo's conventional style (see recent `git log --oneline`).

5. Push the branch to origin:
    - `git push -u origin <branch-name>`

6. Open a PR against `custom` using the GitHub CLI:

    ```
    gh pr create --repo boltmcp/mcp-sdk-ts --base custom --title "<title>" --body "$(cat <<'EOF'
    ## Summary
    <1-3 bullet points>

    ## Test plan
    <bulleted checklist>

    EOF
    )"
    ```

7. Return the PR URL to the user.
