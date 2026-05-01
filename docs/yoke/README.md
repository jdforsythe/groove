# Yoke template: the Groove feature workflow

This directory encodes the Groove framework's feature workflow from `groove.md` as a single Yoke template. Drop it into a project's `.yoke/` directory, customize the example commands (we use `pnpm` for a TypeScript project), split the prompts file, and run.

## Layout

```
.yoke/
  templates/
    feature.yml         # full feature DAG, single config, no human gates
  prompts/              # split prompts.md into 12 files at the markers
    clarify.md
    research.md
    plan-synth.md
    decompose.md
    red.md
    green.md
    refactor.md
    review-fanout.md
    resolve-finding.md
    file-issue.md
    verify-vs-plan.md
    harvest.md
scripts/
  marker-exists.sh      # only needed if you restore human gates (see below)
.substrate/             # project knowledge; checked into git
  vocabulary/INDEX.md
  adr/INDEX.md
  anti-patterns/INDEX.md
  solutions/INDEX.md
  reviewers/INDEX.md
docs/                   # workflow-scoped artifacts; one set per worktree
  brainstorm.md
  research.md
  plan.md
  plan.slices.yml
  findings.json
  issues-filed.json     # registry of GitHub issues created from deferred findings
  verification.md
  harvest.md
```

## How phases compose into the DAG

| Loop primitive | Yoke primitive |
|---|---|
| Phase | `phases.<name>` (command + prompt + pre/post) |
| Fresh-context boundary | New phase = new Claude session (built in) |
| Deterministic gate | `post:` command, `actions: "0": continue, "*": retry` |
| Escalation ladder | `retry_ladder` and per-action `retry: { mode, max }` |
| Slice fan-out | `run: per-item` over a JSONPath-extracted list |
| Slice DAG | `items_depends_on` |
| Priority gate (no human triage) | JSONPath filter on `items_list` |
| Defer + GitHub issue | Second `per-item` stage with a Claude phase calling `gh issue create` |

## What you customize per project

- **`pre:` / `post:` commands.** Replace `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm install --frozen-lockfile` with your project's equivalents.
- **`worktrees.bootstrap.commands`.** Includes `gh auth status` and `jq --version` so the workflow fails fast if defer-stage tools are missing.
- **Reviewer roster.** Edit `.substrate/reviewers/INDEX.md` to declare specialists. Each entry needs a "fires when" predicate that `review-fanout` evaluates against the diff.
- **Skills pack reference.** Each prompt invokes a named skill from the Groove skill pack. Wire that pack in via plugin or local skill directory.

## Restoring human gates

The current config has no human gates. To restore them, insert phases like this between stages:

```yaml
gate-a-plan-approval:
  command: claude
  args: ["--output-format", "stream-json"]
  prompt_template: .yoke/prompts/gate-a.md
  post:
    - name: plan-approved-marker
      run: ["./scripts/marker-exists.sh", "docs/plan.approved"]
      actions:
        "0": continue
        "*":
          retry: { mode: continue, max: 0 }
  retry_ladder: [awaiting_user]
```

The phase pauses until the human drops the marker file and clicks Resume.

## Failure handling

- **Det gate fails** → `retry_ladder` walks: same-context retry → fresh-context retry with failure summary → `awaiting_user`. Default in every `post:` block.
- **Per-finding fix fails repeatedly** → escalates `awaiting_user` for that finding only; other findings continue.
- **Per-slice build fails repeatedly** → escalates `awaiting_user`; downstream slices wait.
- **PR review** → out-of-band on GitHub. If small, follow-up workflow; if fundamental, kill and rerun.

No harness-level "goto." Strict DAG. The retry ladder absorbs the legitimate fix loop; everything beyond is a workflow restart by design.

## Substrate seeding

```bash
mkdir -p .substrate/{vocabulary,adr,anti-patterns,solutions,reviewers}
for d in vocabulary adr anti-patterns solutions reviewers; do
  printf "# %s index\n\n| ID | Description | Path |\n|---|---|---|\n" "$d" > .substrate/$d/INDEX.md
done
```

Add seed reviewers (security, simplicity, architecture) and the seed anti-pattern on horizontal-slice TDD before running.

## Running

```bash
yoke init
# replace default.yml with feature.yml
# split prompts.md per the markers into .yoke/prompts/<name>.md
yoke start
```

## Scope

This template covers the **feature** workflow only. The other three workflow types in the theory (`spike`, `optimize`, `consolidate`) belong in separate template files. They share the same substrate.
