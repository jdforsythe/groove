---
name: resolve-finding
description: >-
  Given a single finding id from docs/findings.json, apply a triage-approved fix
  to the relevant slice, re-run the slice's tests, and record the resolution result.
  Refuses to act on findings where in_scope is false. Aborts and reports if tests
  fail after the fix. Operates on exactly one finding per invocation.
inputs:
  finding_id: "the id of the finding to resolve, e.g. fnd-security-sentinel-001"
  findings_file: "docs/findings.json — produced by review-fanout; skill reads a single entry by id"
outputs:
  resolution: "docs/resolutions/<finding_id>.json — resolution result record enabling triage state to advance"
  fixed_code: "the files named in finding.location.path (or adjacent files the fix touches), modified in place"
substrate_access:
  pattern: eager
  reads:
    - ".substrate/anti-patterns/INDEX.md — scoped to finding.location.path before any fix is applied"
  on_demand: "individual anti-pattern body files (.substrate/anti-patterns/<id>.md) whose scope globs match finding.location.path — loaded only for matches"
---

## Summary

Triggered after triage approves a finding for resolution. Reads the single finding by id from `docs/findings.json` — does not iterate the array. Refuses findings where `in_scope: false`. Eagerly loads anti-pattern entries scoped to `finding.location.path` before touching any code. Applies a fix derived from `suggested_fix` (used as input, not binding) and anti-pattern guidance. Re-runs the slice's test suite; aborts and reports on failure. Writes a resolution record to `docs/resolutions/<finding_id>.json` so triage state can advance. Operates on exactly one finding per invocation; parallelism comes from running multiple instances against independent findings.

## Procedure

### Step 1 — Read and validate the finding

Read `docs/findings.json`. Locate the entry whose `id` matches the provided `finding_id`. Do not iterate every finding — read the file once and extract the single matching entry.

If no entry with the given `finding_id` exists, stop immediately and output:

```
Cannot resolve: finding '<finding_id>' not found in docs/findings.json.
Verify the id and re-run, or check that review-fanout has been run for this workflow.
```

If the found entry has `in_scope: false`, stop immediately and output:

```
Refused: finding '<finding_id>' is out of scope (in_scope: false).
Out-of-scope findings are routed to file-issue or defer, not resolve-finding.
```

Do not modify any files. Do not proceed.

If the finding has `in_scope: true`, continue to Step 2. Record these fields from the finding for use in subsequent steps:

- `id`
- `priority`
- `location.path` (may be absent if the finding is not location-bound — see Step 2 guard)
- `title`
- `description`
- `reproducer` (optional)
- `suggested_fix` (optional)

### Step 2 — Guard: confirm location path is present

If the finding has no `location.path`, the fix site is ambiguous. Stop immediately and output:

```
Cannot resolve: finding '<finding_id>' has no location.path.
A location-bound path is required to scope substrate reads and apply a fix.
Investigate the finding description manually and update docs/findings.json with a location before re-running.
```

Do not proceed.

If `location.path` is present, continue to Step 3.

### Step 3 — Load scoped anti-patterns (eager)

Before reading any source file or applying any fix, load anti-pattern substrate entries scoped to `finding.location.path`.

1. Read `.substrate/anti-patterns/INDEX.md` in full.
2. For each entry in the index, check whether the entry's scope globs (as listed in the index row or derivable from its frontmatter) match `finding.location.path`. Use standard glob matching (`**` matches any path segment, `*` matches within one segment).
3. For each matching anti-pattern entry, open its body file (`.substrate/anti-patterns/<id>.md`) and read it in full.
4. Collect all loaded anti-pattern bodies. These provide "never do X because Y" rules that constrain how the fix may be written.

If no anti-pattern entries match, note that and continue — absence of anti-patterns is not an error.

Do not load anti-patterns from other substrate types (ADRs, solutions, vocabulary) in this step. Those are not scoped to this operation.

### Step 4 — Read the affected file(s)

Read the file at `finding.location.path`. If `finding.location.line_start` and `finding.location.line_end` are present, focus on that range — but read enough surrounding context to understand the structure (e.g., the enclosing function or class).

If the file does not exist at the recorded path, stop and output:

```
Cannot resolve: file '<location.path>' does not exist.
The finding's location may be stale. Re-run review-fanout or update the finding's location before re-running.
```

Do not proceed.

### Step 5 — Derive the fix

Derive a fix from the following inputs, in order of authority:

1. **Anti-pattern rules (Step 3)** — any rule that applies to this location takes precedence. If a rule says "never X", the fix must not introduce X.
2. **Finding description and reproducer** — the finding's `description` and `reproducer` fields characterize the problem precisely. The fix must address the root cause described there.
3. **`suggested_fix`** — treat this as a starting point and informed hint, not a binding prescription. The reviewer's suggestion may not account for anti-pattern rules, project conventions, or surrounding context. Deviate from it when the evidence warrants — but document why.

The fix must be minimal: change only what is necessary to address the finding. Do not refactor adjacent code, add new features, or address other findings. Respect the slice's `out_of_scope` list if available (check `docs/plan.slices.yml` for the slice whose `touched_paths` covers `location.path`).

### Step 6 — Apply the fix

Edit the file(s) required by the fix derived in Step 5. Make only the changes the fix requires.

If the fix requires touching files beyond `finding.location.path`, record each additional file path — you will need it for the resolution record.

### Step 7 — Run the slice's tests

Identify the test suite for the slice whose `touched_paths` covers `finding.location.path`:

1. Read `docs/plan.slices.yml` to find the slice whose `touched_paths` glob matches `finding.location.path`.
2. The slice's `touched_paths` typically includes both source and test globs. Run the tests covering those paths using the project's standard test command (e.g., `npm test`, `pytest`, `go test ./...` — infer from project structure).

If no matching slice is found in `docs/plan.slices.yml`, fall back to running the full project test suite.

**If tests pass:** continue to Step 8.

**If tests fail:** immediately abort. Do not write a resolution record. Output:

```
Resolution aborted: tests failed after applying fix for '<finding_id>'.

Failing tests:
<paste or summarize the test failure output>

The fix has been applied to the working tree but the resolution record has NOT been written.
Review the failure above, adjust the fix, and re-run resolve-finding.
```

Leave the modified files in place so the developer can inspect the diff. Do not revert the fix automatically.

### Step 8 — Write the resolution record

Create the `docs/resolutions/` directory if it does not exist. Write `docs/resolutions/<finding_id>.json`:

```json
{
  "finding_id": "<finding_id>",
  "status": "resolved",
  "resolved_at": "<ISO-8601 datetime>",
  "files_changed": ["<path1>", "<path2>"],
  "fix_summary": "<one-paragraph description of what was changed and why>",
  "deviated_from_suggested_fix": <true | false>,
  "deviation_reason": "<explanation if deviated_from_suggested_fix is true; omit or null if false>",
  "anti_patterns_consulted": ["<anti-pattern-id-1>", "<anti-pattern-id-2>"],
  "tests_run": "<description of which test suite was run>",
  "tests_passed": true
}
```

Field notes:

- `files_changed`: every file path modified by the fix, relative to repo root.
- `fix_summary`: written for a developer reading triage state — describe what was wrong and what the fix does, in plain language.
- `deviated_from_suggested_fix`: `true` if the applied fix differs meaningfully from `suggested_fix`; `false` if it implements `suggested_fix` as-is or nearly so. If the finding had no `suggested_fix`, set to `false`.
- `deviation_reason`: required when `deviated_from_suggested_fix` is `true`; explain which anti-pattern rule or contextual constraint drove the deviation.
- `anti_patterns_consulted`: ids of every anti-pattern entry read in Step 3 whose scope matched; empty array `[]` if none matched.
- `tests_passed`: always `true` at this point (aborted runs never reach Step 8).

### Step 9 — Confirm to the user

After writing the resolution record, output a confirmation:

```
Resolved: <finding_id> (<priority>)
  Title:          <finding.title>
  Files changed:  <comma-separated list>
  Tests run:      <tests_run field value>
  Resolution record: docs/resolutions/<finding_id>.json
```

If the fix deviated from `suggested_fix`, append:

```
  Note: fix deviated from suggested_fix — see deviation_reason in the resolution record.
```

## Constraints

- **One finding per invocation.** Never iterate `docs/findings.json` to resolve multiple findings. Each invocation targets exactly one `finding_id`.
- **Refuse out-of-scope findings.** If `in_scope: false`, stop at Step 1 without touching any file.
- **Require location.path.** If the finding has no `location.path`, stop at Step 2 without touching any file.
- **Eager anti-pattern load.** Anti-patterns scoped to `location.path` must be loaded in Step 3 before reading source files or writing any fix. Do not skip this step even if anti-pattern entries seem unlikely to apply.
- **`suggested_fix` is advisory.** Use it as a starting point. Anti-pattern rules and finding context take precedence.
- **Minimal fix.** Change only what is required to address the finding. Do not refactor unrelated code.
- **Abort on test failure.** Never write the resolution record if tests fail. Leave modified files in place for inspection.
- **Resolution record is JSON.** The artifact at `docs/resolutions/<finding_id>.json` is a machine artifact consumed by downstream triage tooling. Do not write it as Markdown or YAML.
- **Never modify `docs/findings.json`.** The findings file is the output of `review-fanout` and is read-only from the perspective of this skill. Triage state advancement is driven by the resolution record, not by mutating findings.
- **Never address out-of-scope or sibling findings.** If the fix naturally surfaces another finding, note it in `fix_summary` and stop — do not apply unrequested changes.
