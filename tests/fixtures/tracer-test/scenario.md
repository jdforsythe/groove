# tracer-test fixture

Pressure-test specification document. Defines the scenario, expected output properties, and sample bad output used to verify that an agent following the `tracer-test` procedure behaves measurably better than an agent without the skill.

The fixture is fixed. When a scenario fails the differential check, edit the SKILL.md procedure — not this document.

---

## Scenario — "Email notification delivery slice"

**Trigger:** A slice is ready (decompose has completed). No test exists yet for the first acceptance criterion. Run the tracer-test skill.

**Slice (from `docs/plans/add-email-notifications.md`):**

```yaml
id: notification-delivery
title: Send email notification when a workspace comment is posted
acceptance_criteria:
  - Posting a comment triggers an email to all workspace members who have email notifications enabled
  - Delivery failures are logged and do not surface to the commenter
touched_paths:
  - src/notifications/**
  - src/comments/**
  - test/notifications/**
  - test/comments/**
semantic_depends_on:
  - id: notification-preferences
    reason: Delivery logic reads the preferences schema authored by notification-preferences.
out_of_scope:
  - Push notifications
  - SMS notifications
  - Notification batching or digests
  - Unsubscribe flow
```

**Substrate state (available at start):**

`.substrate/anti-patterns/INDEX.md`:

```
# Anti-pattern index

| ID | Description | Scope | Path |
|---|---|---|---|
| mock-entire-mailer | Never mock the entire mailer module at the class level; mock only the send() method | src/notifications/**, test/notifications/** | ./mock-entire-mailer.md |
| test-all-criteria-at-once | Never write tests for all acceptance criteria in a single tracer-test step | **/* | ./test-all-criteria-at-once.md |
```

`.substrate/anti-patterns/mock-entire-mailer.md`:

```markdown
---
id: mock-entire-mailer
type: anti-pattern
description: Never mock the entire mailer module at the class level; mock only the send() method
created: 2025-03-10
scope:
  - src/notifications/**
  - test/notifications/**
tags: [testing, mocking, notifications]
---

## Summary

Applies to notification tests. Mock only `mailer.send()` at the method level — do not replace
the whole `Mailer` class. Class-level mocking hides constructor-level side effects and produces
false positives when the constructor itself is broken.

## Rule

Never replace `Mailer` entirely with a jest mock class or `jest.mock('path/to/mailer')` at the
module level. Instead, spy on or stub only `mailer.send`.

## Reason

Class-level mocking detaches the test from the real constructor path. If `new Mailer()` throws
during setup, class-level mocks hide the error; method-level mocks expose it.

## Positive example

```typescript
// Good: spy on the method, not the class
const sendSpy = jest.spyOn(mailerInstance, 'send').mockResolvedValue({ ok: true });
```
```

`.substrate/anti-patterns/test-all-criteria-at-once.md`:

```markdown
---
id: test-all-criteria-at-once
type: anti-pattern
description: Never write tests for all acceptance criteria in a single tracer-test step
created: 2025-03-12
scope:
  - "**/*"
tags: [testing, tdd, groove]
---

## Summary

Applies to every tracer-test run. Write exactly one test targeting the first unverified
acceptance criterion. Writing tests for multiple criteria in a single step violates the
RED-GREEN discipline: each criterion gets its own RED-GREEN cycle.

## Rule

Never write more than one test block per tracer-test invocation.

## Reason

Multiple tests written at once mean multiple failing tests, which makes the GREEN step
ambiguous: which test should pass first? The discipline is one failing test → one
implementation step → one green test → optionally refactor → repeat.

## Positive example

One `it` block per tracer-test run. If the slice has three criteria, tracer-test runs
three times — one per criterion, one per RED-GREEN cycle.
```

**Codebase state (hypothetical):**

- `src/notifications/` — directory exists but is empty (no delivery logic yet)
- `src/comments/` — `comment.service.ts` exists with `postComment()` method; does not emit notifications
- `test/notifications/` — empty directory
- `test/comments/` — `comment.service.test.ts` exists, tests `postComment()` but does not test notifications
- `package.json` — uses Jest as test runner; `test/` follows `*.test.ts` naming convention

**No existing test covers the first acceptance criterion** ("Posting a comment triggers an email to all workspace members who have email notifications enabled").

---

## Expected output properties (with-skill behavior)

An agent following the `tracer-test` skill must exhibit ALL of the following properties:

1. **Eager anti-pattern load scoped to touched_paths**: Before writing any test, the agent reads `.substrate/anti-patterns/INDEX.md` and fetches the body of `mock-entire-mailer` (whose scope matches `src/notifications/**` and `test/notifications/**`) and `test-all-criteria-at-once` (whose scope `**/*` matches all paths). The agent does not skip this step even if it believes no anti-patterns are relevant.

2. **Targets only the first acceptance criterion**: The test description and assertions map to criterion 0: "Posting a comment triggers an email to all workspace members who have email notifications enabled." The test does not assert anything about criterion 1 ("Delivery failures are logged...").

3. **Exactly one test block written**: The output contains a single `it` / `test` block. No `describe` suite covering the whole module. No second test case for any other scenario.

4. **Test mocks at method level, not class level**: Respecting the `mock-entire-mailer` anti-pattern, the agent spies on `mailer.send` rather than replacing the `Mailer` class entirely.

5. **No implementation written**: The agent writes only a test file (e.g., `test/notifications/notification-delivery.test.ts` or adds one test to `test/comments/comment.service.test.ts`). It does not write `src/notifications/delivery.service.ts` or fill in `src/comments/comment.service.ts`.

6. **Test will fail on the current codebase**: The agent explicitly states why the test will fail (e.g., `postComment()` does not currently emit notifications, so the `mailer.send` spy will never be called).

7. **Output message format**: After writing, the agent outputs the required summary:
   - Slice id
   - Criterion targeted (verbatim)
   - Test file path
   - One-line expected failure reason
   - "Next step: run slice-impl to pass this test."

### Example of compliant test output (with-skill)

```typescript
// test/notifications/notification-delivery.test.ts

// Criterion: Posting a comment triggers an email to all workspace members who have email notifications enabled

import { postComment } from '../../src/comments/comment.service';
import { mailer } from '../../src/notifications/mailer';

it('sends an email to each workspace member with notifications enabled when a comment is posted', async () => {
  const sendSpy = jest.spyOn(mailer, 'send').mockResolvedValue({ ok: true });

  const members = [
    { id: 'u1', email: 'alice@example.com', notificationsEnabled: true },
    { id: 'u2', email: 'bob@example.com', notificationsEnabled: false },
    { id: 'u3', email: 'carol@example.com', notificationsEnabled: true },
  ];

  await postComment({ workspaceId: 'ws-1', authorId: 'u0', body: 'Hello team', members });

  // Only members with notificationsEnabled: true should receive an email
  expect(sendSpy).toHaveBeenCalledTimes(2);
  expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ to: 'alice@example.com' }));
  expect(sendSpy).toHaveBeenCalledWith(expect.objectContaining({ to: 'carol@example.com' }));
});
```

Agent output after writing:

```
tracer-test complete.
Slice: notification-delivery
Criterion targeted: "Posting a comment triggers an email to all workspace members who have email notifications enabled"
Test file: test/notifications/notification-delivery.test.ts
Expected failure: postComment() does not currently call mailer.send(); the spy will never be called, so toHaveBeenCalledTimes(2) will fail with received 0.

Next step: run slice-impl to pass this test.
```

---

## Sample bad output (without-skill behavior)

An agent **without** the `tracer-test` skill typically exhibits one or more of the following failure modes when given the same slice:

### Bad output example A — writes multiple tests covering all criteria

```typescript
// test/notifications/notification-delivery.test.ts

describe('NotificationDelivery', () => {
  it('sends email to workspace members with notifications enabled', async () => {
    // ... test for criterion 1
  });

  it('logs delivery failures without surfacing to commenter', async () => {
    // ... test for criterion 2
  });

  it('does not send to members with notifications disabled', async () => {
    // ... additional edge case
  });
});
```

Failure modes present:
- Writes 3 tests instead of 1
- Covers criterion 2 ("Delivery failures are logged...") which is out of scope for this step
- Adds an untargeted edge-case test beyond the acceptance criteria
- Violates `test-all-criteria-at-once` anti-pattern (if it had been loaded)

### Bad output example B — writes implementation alongside the test

```typescript
// test/notifications/notification-delivery.test.ts

it('sends email to workspace members with notifications enabled', async () => {
  // test code
});
```

```typescript
// src/notifications/delivery.service.ts   ← WRONG: implementation written in same step

export async function sendCommentNotification(comment, members) {
  const enabled = members.filter(m => m.notificationsEnabled);
  await Promise.all(enabled.map(m => mailer.send({ to: m.email, subject: 'New comment', body: comment.body })));
}
```

Failure modes present:
- Writes implementation in the same step as the test — the RED phase and GREEN phase are collapsed
- The test now likely passes immediately, eliminating the RED state
- Violates the core discipline: tracer-test is RED only

### Bad output example C — mocks the entire mailer class

```typescript
// test/notifications/notification-delivery.test.ts

jest.mock('../../src/notifications/mailer');  // ← class-level mock: violates anti-pattern

import { Mailer } from '../../src/notifications/mailer';

it('sends email to workspace members with notifications enabled', async () => {
  const mockSend = jest.fn();
  (Mailer as jest.Mock).mockImplementation(() => ({ send: mockSend }));

  await postComment({ workspaceId: 'ws-1', authorId: 'u0', body: 'Hello', members });

  expect(mockSend).toHaveBeenCalledTimes(2);
});
```

Failure modes present:
- Uses `jest.mock()` at the module level, replacing the entire `Mailer` class
- Violates `mock-entire-mailer` anti-pattern (not loaded because substrate was skipped)
- Hides constructor-level errors; produces false positives

### Bad output example D — targets the wrong criterion

```typescript
// test/notifications/notification-delivery.test.ts

it('logs delivery failures without surfacing to the commenter', async () => {
  // tests criterion 2, skipping criterion 1
});
```

Failure modes present:
- Targets `acceptance_criteria[1]` instead of `acceptance_criteria[0]`
- criterion 0 remains uncovered — the slice cannot enter the RED-GREEN cycle correctly

---

## Differential check criteria

Run a subagent with the `tracer-test` skill loaded against the scenario above. Run the same subagent without the skill. Compare outputs using these binary criteria:

| Criterion | With-skill | Without-skill |
|---|---|---|
| Reads `.substrate/anti-patterns/INDEX.md` before writing any test | yes | no |
| Fetches `mock-entire-mailer` body (scope matches touched_paths) | yes | no |
| Writes exactly one test block | yes | no (typically 2–5 tests) |
| Test targets only `acceptance_criteria[0]` | yes | no (often covers multiple criteria) |
| No implementation code written | yes | no (often writes impl alongside) |
| Mocks at method level (`jest.spyOn`), not class level (`jest.mock`) | yes | no (uses class-level mock) |
| Test will fail on current codebase (agent explicitly confirms this) | yes | no (often writes a passing test by including impl) |
| Output summary names the criterion, path, and expected failure reason | yes | no (no structured output) |

The skill passes the differential check when the with-skill run satisfies all eight criteria and the without-skill run fails at least five of them.

---

## Edge case: passing test already exists

**Prompt:**

> The slice is `notification-delivery`. The test `test/notifications/notification-delivery.test.ts` already exists and its first test ("sends email to workspace members with notifications enabled") passes on the current codebase.

**Expected behavior (with-skill):**

The agent outputs:

```
tracer-test refused: a passing test already covers the first acceptance criterion.
Criterion: "Posting a comment triggers an email to all workspace members who have email notifications enabled"
Existing test: test/notifications/notification-delivery.test.ts:5 — "sends email to workspace members with notifications enabled"

This slice is already in GREEN for its first criterion. Run slice-impl (or slice-refactor if
already green) instead. Do not re-run tracer-test unless the criterion changes.
```

No file is written. No anti-patterns are loaded (the refusal fires before Step 2).

**Expected behavior (without-skill):**

The agent typically writes a second test alongside the passing one, or overwrites the passing test with a new failing one — both of which corrupt the test suite.

---

## Edge case: user asks to target criterion 2 instead of criterion 1

**Prompt:**

> For slice `notification-delivery`, please write a test for the second criterion ("Delivery failures are logged and do not surface to the commenter") — skip the first one for now.

**Expected behavior (with-skill):**

The agent declines and explains:

```
tracer-test targets acceptance_criteria[0] only.
The first criterion ("Posting a comment triggers an email to all workspace members who have email notifications enabled") has not yet been covered.

Run the RED-GREEN cycle for criterion 0 first:
1. tracer-test → writes a failing test for criterion 0
2. slice-impl → passes the test for criterion 0
3. (optional) slice-refactor → refactors while green
Then re-invoke tracer-test to write a failing test for criterion 1.
```

**Expected behavior (without-skill):**

The agent complies and writes a test for criterion 2, leaving criterion 1 uncovered and breaking the RED-GREEN ordering.
