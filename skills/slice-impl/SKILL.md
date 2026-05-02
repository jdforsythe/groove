---
name: slice-impl
description: >-
  Write the minimum implementation to pass the failing tracer test for a slice.
  Fires when a failing tracer test exists for the slice. Reads the slice
  (including out_of_scope) and the failing test before writing anything.
  Refuses to add features listed in out_of_scope. Refuses to modify the test.
inputs:
  slice: "A slice entry from docs/plans/<workflow_id>.md — id, title, acceptance_criteria, touched_paths, out_of_scope"
  failing_test: "The failing tracer test file produced by tracer-test for this slice"
outputs:
  implementation: "The minimal source file(s) under touched_paths that make the failing test pass"
substrate_access:
  pattern: eager
  reads:
    - .substrate/anti-pattern/INDEX.md
  on_demand: "Anti-pattern bodies fetched via substrate-read when scope glob matches the slice's touched_paths"
---

## Summary

Triggered when a failing tracer test exists for the slice. Eagerly loads anti-pattern entries scoped to the slice's `touched_paths` before writing anything. Reads the slice definition (including `out_of_scope`) and the failing test in full. Writes the minimum implementation that makes the failing test pass and keeps all existing tests green. Refuses to add any feature listed in `out_of_scope`. Refuses to modify the test. Stops if no failing test exists or if the failing test does not belong to this slice.

## Procedure

### Step 1 — Verify a failing test exists for this slice

Before reading any artifact, confirm that:

1. A test file for this slice exists. The failing tracer test for slice `<slice_id>` is produced by `tracer-test` — confirm the file is present.
2. The test is currently failing (exits non-zero). Run the test suite or the single test file to confirm. If the test is passing, stop and output:

```
Cannot start slice-impl: no failing test found for slice <slice_id>.
The test at <test_path> is already passing (or no test file exists).
Run tracer-test for this slice first, then run slice-impl.
```

3. The test is for this slice, not a different one. Read the test file header comment or the first few lines to confirm the slice id or scope matches. If the test targets a different slice, stop and output:

```
Cannot start slice-impl: the failing test at <test_path> is for slice <other_slice_id>,
not slice <slice_id>. Provide the correct test file for this slice.
```

Do not proceed until all three conditions are confirmed.

### Step 2 — Load eager substrate (anti-patterns scoped to touched_paths)

Before reading the slice or the test, load the anti-pattern index:

- `.substrate/anti-pattern/INDEX.md`

For each anti-pattern index entry, check whether its `scope` overlaps the slice's `touched_paths` globs. Fetch the body of every matching anti-pattern entry via `substrate-read` before proceeding.

Record each loaded anti-pattern as a constraint that the implementation must not violate.

If the anti-pattern index does not exist or is empty, continue — absence of anti-patterns is not a blocker.

### Step 3 — Read the slice definition

Read the slice entry in full from `docs/plans/<workflow_id>.md`. Extract and record:

- `id` — the stable slice identifier
- `title` — the slice description
- `acceptance_criteria` — the list of observable behaviors the slice must satisfy
- `touched_paths` — the globs that bound the implementation's blast radius
- `out_of_scope` — the explicit YAGNI guards; **this list is a hard constraint**

Internalize `out_of_scope` as a set of prohibited features. Any item listed there must not appear in the implementation, regardless of how natural or helpful it might seem.

### Step 4 — Read the failing test

Read the failing test file in full. Understand:

- Which acceptance criterion the test exercises (it tests exactly one criterion — tracer-test writes one test per run)
- What the test asserts (the expected observable behavior)
- What interface, function, module, or API the test imports or calls (these are the implementation entry points you must satisfy)
- What the test does NOT assert (do not implement behavior beyond what the test requires)

Do not write any implementation yet.

### Step 5 — Plan the minimal implementation

Before writing code, reason through the smallest change that satisfies all of the following simultaneously:

1. **The failing test passes.** Every assertion in the failing test succeeds.
2. **Existing tests stay green.** No currently-passing test is broken.
3. **`out_of_scope` is not violated.** None of the items in the slice's `out_of_scope` list appear in the implementation.
4. **Anti-patterns are not violated.** None of the loaded anti-pattern constraints from Step 2 are violated.
5. **Implementation stays within `touched_paths`.** Only files matching the slice's `touched_paths` globs are created or modified.

If satisfying the failing test requires changes to files outside `touched_paths`, stop and report:

```
slice-impl blocked: the failing test requires changes outside the slice's touched_paths.
  Test requires: <path>
  Slice touched_paths: <globs>
Escalate to the plan author to update the slice definition before proceeding.
```

If satisfying the failing test would require adding a feature listed in `out_of_scope`, stop and report:

```
slice-impl refused: the failing test requires implementing "<out_of_scope_item>",
which is explicitly listed in this slice's out_of_scope.
  out_of_scope entry: <item>
The test or the slice definition needs to be reviewed before proceeding.
```

Do not write any code if either blocker applies.

### Step 6 — Write the implementation

Write the minimum code required. Apply these rules:

- **Minimum surface.** Implement only what is needed to satisfy the failing test's assertions. Do not add methods, properties, classes, endpoints, or configuration beyond what the test exercises.
- **No test modification.** The test file is read-only. Do not edit it, rename it, move it, or add comments to it.
- **No scope creep.** If writing the implementation surfaces a natural next step or improvement, do not add it. Note it in your output summary instead.
- **Respect anti-patterns.** Apply every constraint loaded in Step 2 to the implementation approach.
- **Respect `out_of_scope`.** Cross-check each code element added against the `out_of_scope` list before committing it. If an element is borderline, err on the side of exclusion.

### Step 7 — Verify

After writing the implementation, run the test suite:

1. **Failing test now passes.** Run the specific failing test file. Confirm it exits green.
2. **Existing tests still pass.** Run the full test suite. Confirm no regressions.

If the failing test still fails after writing the implementation, diagnose and correct the implementation. Do not modify the test.

If existing tests regress, diagnose and correct the implementation to eliminate the regression. Do not modify existing tests.

Repeat Steps 5–7 as needed until both conditions hold.

### Step 8 — Report

Confirm the result to the user:

```
slice-impl complete.
Slice: <slice_id> — <title>
Test: <test_path> — now passing
Files written or modified:
  <path> — <one-line description of what was added>
  ...
out_of_scope enforced (not added):
  - <item>
  - <item>
Anti-patterns applied: <count> (<list of anti-pattern ids loaded>)
Existing tests: <N> passing, 0 regressions
```

If no `out_of_scope` items were at risk of inclusion, omit that section. If no anti-patterns were loaded, omit that section.

## Constraints

- **Test is read-only.** The failing test file must not be modified in any way. Passing tests by editing them defeats the purpose of the tracer test.
- **Fail fast if no failing test.** If no failing test exists for this slice, refuse immediately. Do not write implementation speculatively.
- **Fail fast if wrong test.** If the failing test targets a different slice, refuse immediately.
- **`out_of_scope` is a hard constraint.** Items listed there are prohibited features, not suggestions. Any implementation element that corresponds to an `out_of_scope` item must be removed.
- **Anti-patterns are read eagerly before any code is written.** The `touched_paths` scope filter must be applied at the index layer; only matching entries are fetched in full.
- **Stay within `touched_paths`.** Implementation changes must not create or modify files outside the slice's declared globs. Violations require escalation, not workarounds.
- **Minimum, not maximal.** The goal is the smallest change that satisfies the test. Elegance and completeness beyond what the test exercises are the concern of `slice-refactor`, not this skill.
- **Never mention any specific harness.** Skills compose via shared artifact paths; the composition graph is the harness's concern.
