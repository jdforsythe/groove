---
id: never-write-all-tests-first
type: anti-pattern
description: Writing all tests for a slice before writing any implementation leads to test suites that require major rewrites when implementation details shift.
created: 2026-05-01
scope: ["**"]
---

## Summary

Never write all tests for a slice upfront before beginning any implementation. Write one failing test, make it pass, then write the next. Batch-writing tests first produces a speculative test suite that becomes a liability when early implementation attempts reveal that the initial mental model was wrong.

## Rule

Never write all tests for a slice or feature before writing any implementation code.

## Reason

Because batch-writing tests first creates tight coupling between the test suite and speculative implementation details. When the first implementation attempts reveal that the initial mental model was wrong — and they usually do — you must rewrite both the tests and the code simultaneously. The feedback loop is delayed, the correction cost is multiplied, and the test suite represents a past guess rather than verified behavior.

## Positive example

Correct one-failing-test-at-a-time approach:

```
1. Write one test: test("renders empty state when list is empty") → RED (fails)
2. Write the minimum code to make that test pass → GREEN
3. Refactor if needed; tests still pass
4. Write next test: test("renders item when list has one entry") → RED (fails)
5. Write the minimum code to make that test pass → GREEN
6. Continue until all acceptance criteria are covered by passing tests
```

Each test is written against code that already exists. The test describes observed behavior, not hoped-for behavior. Implementation never races ahead of verification, and every test that passes represents a real contract — not a wish.
