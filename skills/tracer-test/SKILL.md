---
name: tracer-test
description: >-
  Write exactly ONE failing test targeting a slice's first acceptance criterion.
  Fires when a slice is ready and no passing test yet covers the first criterion.
  Never writes implementation. Refuses to run if a passing test already covers
  the criterion.
inputs:
  slice: "A single slice entry from docs/plans/<workflow_id>.md — must have id, title, acceptance_criteria (at minimum one entry), touched_paths, and out_of_scope."
outputs:
  test_file: "One test file (new or a single test added to an existing file) within the slice's touched_paths. The test must fail when run because the implementation does not yet exist."
substrate_access:
  pattern: eager
  reads:
    - .substrate/anti-patterns/INDEX.md
  on_demand: "Anti-pattern body files for entries whose scope globs match any path in the slice's touched_paths."
  rationale: "Anti-patterns are read eagerly so that the test file cannot inadvertently encode a known anti-pattern in its test structure or fixtures. Only entries scoped to the slice's touched_paths are fetched."
---

## Summary

Triggered when a slice is ready (from `decompose`) and no test yet covers its first acceptance criterion. Eagerly loads anti-pattern index; fetches bodies only for anti-patterns scoped to the slice's `touched_paths`. Writes exactly one failing test that targets the first acceptance criterion only. Never writes implementation. Refuses if a passing test for the first criterion already exists. The test is the tracer bullet: it must fail on run, confirming the behavior is not yet implemented.

## Procedure

### Step 1 — Verify preconditions

Before writing anything, perform all three checks in order. Stop at the first failure.

#### 1a. Slice is valid

The slice must have all required fields:

- `id` — non-empty string
- `title` — non-empty string
- `acceptance_criteria` — array with at least one entry; `acceptance_criteria[0]` is the **target criterion**
- `touched_paths` — at least one glob
- `out_of_scope` — present (may be empty array)

If any required field is missing or `acceptance_criteria` is empty, stop and output:

```
Cannot start tracer-test: slice <id> is missing required fields.
Required: id, title, acceptance_criteria (at least one entry), touched_paths, out_of_scope.
Run plan-synth and decompose to produce a valid slice before running tracer-test.
```

Do not proceed until the slice is valid.

#### 1b. No passing test already covers the first acceptance criterion

Scan the codebase for tests within the slice's `touched_paths` that target the first criterion. A test "covers" the first criterion when:

- It exists in the repository, AND
- It passes on the current codebase (i.e., it would not fail if run now), AND
- Its description or assertion clearly maps to the first acceptance criterion (not just shares a file path).

If a passing test that covers the first criterion is found, stop and output:

```
tracer-test refused: a passing test already covers the first acceptance criterion.
Criterion: "<acceptance_criteria[0]>"
Existing test: <file>:<line> — "<test description>"

This slice is already in GREEN for its first criterion. Run slice-impl (or slice-refactor if
already green) instead. Do not re-run tracer-test unless the criterion changes.
```

Do not proceed if a passing test already covers the criterion.

#### 1c. Identify the target test location

Determine where the test should live:

1. Look for an existing test file within the slice's `touched_paths` that is clearly associated with the component under test (same module, same naming convention as other test files in the project).
2. If one exists, the new test will be added as a single test case within that file.
3. If no test file exists yet, identify the correct path for a new test file following the project's naming convention (e.g., `<module>.test.ts`, `<module>_test.py`, `test_<module>.py`).

Record the target path — this is where the single test will be written.

### Step 2 — Load scoped anti-patterns (eager)

Read `.substrate/anti-patterns/INDEX.md`. For each anti-pattern entry in the index:

- Check whether the entry's `scope` globs overlap with any path in the slice's `touched_paths`.
- An overlap exists when at least one glob in the anti-pattern's `scope` matches at least one path in the slice's `touched_paths` (use glob pattern matching, not substring matching).

For each matching anti-pattern, fetch its body file and read it fully. If the index is empty or no anti-patterns match the slice's `touched_paths`, continue without substrate content — the absence of anti-patterns is normal, not an error.

Record the matching anti-patterns. They constrain how the test is written (see Step 3).

### Step 3 — Identify the target criterion

The target criterion is always `acceptance_criteria[0]` — the first entry in the array. Do not target any other criterion in this step.

Read the criterion carefully. It is phrased as an observable behavior ("test-in-prose"). Parse it into two parts:

- **Subject** — what system, module, or function is being tested?
- **Observable behavior** — what must be true when the test runs?

The test must confirm the observable behavior is absent today (it will fail because the implementation does not yet exist) and confirm it is present after implementation (it will pass when the GREEN phase ships).

Check the `out_of_scope` list. If any `out_of_scope` item could be confused with the first criterion, note it — the test must not inadvertently exercise out-of-scope behavior.

### Step 4 — Write exactly one failing test

Write a single test targeting only the first acceptance criterion. Apply all constraints simultaneously:

#### What the test must do

- Assert the observable behavior described by `acceptance_criteria[0]`.
- Be runnable with the project's existing test runner (infer from `package.json`, `pyproject.toml`, `Makefile`, or the test files already present in `touched_paths`).
- Fail when run against the current codebase (because the implementation does not exist yet). If the test would accidentally pass — because the behavior is already partially implemented — revise the assertion to target the unimplemented part specifically.
- Include a descriptive test name that quotes or closely paraphrases the acceptance criterion. This is the link between the test and the slice.

#### What the test must not do

- **Do not write implementation code.** Do not add production source files, do not fill in function bodies, do not add data models. The only file created or modified is the test file.
- **Do not test criteria beyond the first.** If the slice has three acceptance criteria, this step covers only `acceptance_criteria[0]`. The remaining criteria are addressed in subsequent `tracer-test` runs (one per red-green cycle).
- **Do not write setup or teardown that covers out-of-scope behavior.** Fixtures and mocks must be minimal: just enough to run the assertion for the first criterion.
- **Do not violate any anti-pattern** retrieved in Step 2. If an anti-pattern warns against a specific test structure (e.g., "never use class-level mocks for this module"), use the alternative approach described in the anti-pattern body.

#### Minimal test structure

The test must be the minimum code to run the assertion. Prefer:

- A single `it` / `test` / `def test_` block.
- Inline minimal fixtures — only what the assertion requires.
- A comment on the first line of the test block quoting the acceptance criterion it targets.

Avoid:

- `describe` blocks that suggest the test covers an entire module — use a targeted description.
- Multiple assertions in one test — one criterion, one assertion (or one logical assertion chain).
- Shared state that would affect other tests.

### Step 5 — Confirm the test will fail

Before writing the file, reason explicitly about why the test will fail on the current codebase:

> The test calls `<function/endpoint/method>` which does not yet exist (or does not yet exhibit `<behavior>`). Running the test now will produce `<expected error: import error / assertion failure / TypeError / etc.>`.

If you cannot identify a reason the test will fail, it is not a tracer bullet — revise the assertion to target something genuinely unimplemented. Do not write a test that passes on the current codebase.

### Step 6 — Write the file

Write exactly one file (the target path from Step 1c). If adding to an existing file, add exactly one new test block — do not modify existing tests.

After writing, output:

```
tracer-test complete.
Slice: <id>
Criterion targeted: "<acceptance_criteria[0]>"
Test file: <path>
Expected failure: <one-line explanation of why the test fails now>

Next step: run slice-impl to pass this test.
```

Do not commit, push, or open a PR. Do not write a second test.

## Constraints

- **One test only.** Exactly one test block (or one test case in an existing file) per run. If the temptation arises to write a second test "while you're in the file," do not. Each additional criterion gets its own `tracer-test` run, its own RED-GREEN cycle.
- **No implementation.** This step writes test code only. Source files, migration files, and configuration files are out of scope. If any production code must change for the test to be importable (e.g., the module does not exist at all), create an empty stub (with no logic) and note it — but do not implement behavior.
- **Eagerly scoped anti-patterns.** Anti-patterns must be loaded before the test is written, not after. Do not skip Step 2 even if no anti-patterns are expected.
- **Refuse on passing test.** If the precondition check in Step 1b finds a passing test covering the first criterion, refuse unconditionally. Do not write a second test alongside the passing one; do not modify the passing test; do not weaken the check.
- **First criterion only.** The `acceptance_criteria` list is ordered. tracer-test targets index 0. If the user requests targeting a different criterion, decline and explain: run the RED-GREEN cycle for criterion 0 first, then re-invoke tracer-test for criterion 1.
- **Test must fail.** If the test passes on the current codebase, the precondition is wrong (a passing implementation already exists) or the test is too weak. Both are errors. Revise before writing.
- **Never mention any specific harness.** Skills compose via shared artifact paths and substrate; the composition graph is the harness's concern.
