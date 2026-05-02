---
name: slice-refactor
description: >-
  Optional post-green cleanup of a slice's implementation. Fires when the
  slice's test suite is green after slice-impl completes. Reads the slice
  definition and test files; modifies only implementation files. Tests must
  be green before starting and must remain green throughout. Aborts and reverts
  if any refactor step breaks a test. Skipped when the green implementation
  already reads cleanly.
optional: true
inputs:
  slice: "A slice entry from docs/plans/<workflow_id>.md — id, title, acceptance_criteria, touched_paths, out_of_scope"
  implementation: "The source file(s) under touched_paths produced by slice-impl"
  test_suite: "The test file(s) for this slice — produced by tracer-test, possibly expanded by subsequent cycles"
outputs:
  implementation: "The same file(s) under touched_paths, refactored for clarity, DRY, and pattern alignment; behavior unchanged"
substrate_access:
  pattern: eager
  reads:
    - .substrate/anti-pattern/INDEX.md
  on_demand: "Anti-pattern bodies fetched via substrate-read when scope glob matches the slice's touched_paths"
---

## Summary

Triggered after `slice-impl` leaves the slice green. This skill is optional: if the implementation already reads cleanly, skip it. When it runs, it eagerly loads anti-pattern entries scoped to the slice's `touched_paths` before reading anything else. Reads the slice definition (including `out_of_scope`) and the test files in full. Refactors the implementation for clarity, DRY, and pattern alignment without changing observable behavior. Tests must be green before any change is made, and must remain green after every change. If a refactor step breaks a test, the skill aborts immediately and reverts the change — it does not modify the test to restore green. Stops as soon as no obvious cleanup remains; it does not invent refactors to fill time.

## Procedure

### Step 1 — Decide whether to run

Before doing anything else, answer: does the implementation obviously benefit from cleanup? Signals that warrant running:

- Duplicated logic that could be extracted into a shared function or constant
- Inline magic values that would read more clearly as named constants
- Nested conditionals that could be flattened or guard-claused
- Variable or function names that obscure intent
- Structural mismatch with patterns already established in the project (visible from the implementation files themselves or from loaded anti-patterns)

If none of these signals are present — the implementation is short, direct, and already idiomatic — stop and output:

```
slice-refactor skipped: <slice_id> — implementation reads cleanly, no refactor needed.
```

Do not proceed. The skill is optional; skipping it is the correct outcome when the implementation is already clean.

### Step 2 — Verify tests are green before starting

Before making any change to any file, run the full test suite. Confirm that:

1. All tests pass (exit zero).
2. The test file(s) for this slice are among the passing tests.

If any test is failing before this skill has touched anything, stop and output:

```
slice-refactor blocked: tests are not green before refactor.
  Failing: <test_file> — <failure summary>

This slice's implementation must be green before slice-refactor can run.
Fix the failure with slice-impl (or resolve-finding for a reviewed finding), then retry.
```

Do not make any implementation change until the pre-refactor green check passes.

### Step 3 — Load eager substrate (anti-patterns scoped to touched_paths)

Load the anti-pattern index:

- `.substrate/anti-pattern/INDEX.md`

For each entry, check whether its `scope` overlaps the slice's `touched_paths` globs. Fetch the body of every matching anti-pattern via `substrate-read` before proceeding.

Record each loaded anti-pattern as a constraint the refactored implementation must not violate.

If the anti-pattern index does not exist or is empty, continue — absence of anti-patterns is not a blocker.

### Step 4 — Read the slice definition and tests

Read the slice entry in full from `docs/plans/<workflow_id>.md`. Extract and record:

- `id`, `title`, `acceptance_criteria`
- `touched_paths` — bounds the implementation blast radius; refactor must not create or modify files outside these globs
- `out_of_scope` — hard constraint; no item from this list may be added during refactor

Read each test file in full. Note:

- What each test asserts (the observable behavior the implementation must preserve)
- What the tests do NOT assert (do not extract or expose additional behavior during refactor)

The test files are read-only. Do not modify, rename, move, or annotate them under any circumstances.

### Step 5 — Plan the refactor

Before changing any file, write down the specific refactor moves you intend to make. Each move must satisfy all of the following:

1. **Behavior-preserving.** The change improves structure, naming, or DRY without altering observable behavior. A test that was passing will still pass; a test that was failing will not suddenly pass (that would indicate behavior was added).
2. **Within `touched_paths`.** No new files created and no files modified outside the slice's declared globs.
3. **No `out_of_scope` additions.** Cross-check each planned change against `out_of_scope`. If a cleanup move would naturally pull in something on the `out_of_scope` list, stop that move — note it in the final report instead.
4. **No anti-pattern violations.** Every planned change must respect the constraints loaded in Step 3.
5. **No new features.** If a move would add behavior not asserted by any test (even useful behavior), discard that move.

If planning produces no valid moves, skip to Step 7 with the note that no cleanup was warranted.

### Step 6 — Apply refactor moves, one at a time

Apply each planned move independently. After each move:

1. **Run the test suite.** Confirm all tests still pass.
2. **If tests pass:** proceed to the next move.
3. **If tests fail:** immediately revert this move (restore the file to its state before this move was applied) and stop. Do not attempt to fix the test failure by modifying the test or by making additional implementation changes to work around it.

Output for an aborted move:

```
slice-refactor aborted move: <description of the move that broke tests>
  Reverted: <file path(s)>
  Failing test: <test_file> — <failure summary>

The implementation has been restored to its pre-move state.
Remaining planned moves were not attempted.
```

After aborting, skip to Step 7. Report what was successfully applied and what was aborted.

Repeat for each planned move until all moves are applied or one is aborted.

Stop when all planned moves are exhausted. Do not invent additional moves once the planned list is done.

### Step 7 — Verify final state

After all moves (or after an abort), run the full test suite one final time. Confirm all tests pass. If they do not (which should only happen if the abort logic in Step 6 failed to restore cleanly), report the failure and the exact file state, and ask the user for guidance before proceeding.

### Step 8 — Report

Confirm the result to the user:

```
slice-refactor complete.
Slice: <slice_id> — <title>
Pre-refactor check: all tests green
Moves applied:
  <file> — <one-line description of refactor move>
  ...
Moves skipped (out_of_scope or no-behavior-change violated):
  - <description> — <reason skipped>
Post-refactor check: all tests green
Anti-patterns applied: <count> (<list of anti-pattern ids loaded>)
```

If any move was aborted:

```
slice-refactor partial.
Slice: <slice_id> — <title>
Pre-refactor check: all tests green
Moves applied before abort:
  <file> — <description>
Move aborted:
  <description> — broke <test_file>
  Reverted: <file path(s)>
Post-abort check: all tests green
```

If the skill was skipped (Step 1), no further reporting is needed beyond the skip message.

## Constraints

- **Optional.** When the implementation already reads cleanly, skip entirely. A skip is a successful outcome, not a failure.
- **Tests are read-only.** Test files must not be modified, renamed, moved, or annotated. If a refactor breaks a test, revert the refactor — do not fix the test.
- **Pre-check is mandatory.** If tests are not green before the skill runs, refuse to start. Do not refactor a broken implementation.
- **Abort-and-revert on test failure.** If any single move breaks a test, revert that move immediately and stop. Do not attempt workarounds in the implementation. Do not modify the test.
- **One move at a time.** Apply planned moves individually, running the test suite after each. Never batch multiple moves and test once.
- **No `out_of_scope` additions.** Items on the slice's `out_of_scope` list are prohibited even when they arise naturally from cleanup. Note them in the report; do not implement them.
- **No new features.** A refactor must not make any previously-failing test pass, add behavior not exercised by the test suite, or expose new public interface.
- **Stay within `touched_paths`.** Implementation changes must not create or modify files outside the slice's declared globs.
- **Stop when clean.** Once the planned move list is exhausted and all tests are green, stop. Do not invent further refactors to fill time or reach an arbitrary quality bar.
- **Anti-patterns are constraints, not suggestions.** Every loaded anti-pattern applies to the refactored implementation as fully as it applied to the original. A refactor that introduces an anti-pattern violation is not an improvement.
- **Never mention any specific harness.** Skills compose via shared artifact paths; the composition graph is the harness's concern.
