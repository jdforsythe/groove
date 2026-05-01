# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## Label setup

The repo uses the five canonical triage labels (see `docs/agents/triage-labels.md`). Any pre-existing labels should be deleted and replaced with these five. To reset labels:

```bash
# Delete all existing labels
gh label list --json name --jq '.[].name' | xargs -I{} gh label delete "{}" --yes

# Create canonical labels
gh label create "needs-triage"    --color "e4e669" --description "Maintainer needs to evaluate"
gh label create "needs-info"      --color "d93f0b" --description "Waiting on reporter"
gh label create "ready-for-agent" --color "0075ca" --description "Fully specified, AFK-ready"
gh label create "ready-for-human" --color "008672" --description "Requires human implementation"
gh label create "wontfix"         --color "ffffff" --description "Will not be actioned"
```

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.
