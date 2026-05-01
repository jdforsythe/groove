This repository houses the Groove theory (process for getting work planned and implemented), Groove example skill set, and [yoke](https://github.com/jdforsythe/yoke) example config to run the skills in the yoke harness.

The theory is general and not agent/skill/implementation-specific. It should never mention yoke - it's harness-agnostic and even implementable by a human by hand.

The skills are one example implementation of a set of skills described by the theory. Again, they are harness-agnostic and can be run in the right order directly by a human. They should never mention yoke.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (`github.com/jdforsythe/groove`). See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the five canonical default label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo — one `CONTEXT.md` + `docs/adr/` at the root. See `docs/agents/domain.md`.
