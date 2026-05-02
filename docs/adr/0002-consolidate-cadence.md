---
id: consolidate-cadence
type: adr
description: Consolidate runs on weekly cron as the default, with signal-based override as an optional addition
created: "2026-05-01"
status: accepted
tags:
  - consolidate
  - substrate
  - harness
---

## Summary

The `consolidate` skill (substrate hygiene) needs a trigger cadence. This ADR records the decision to default to weekly cron execution and to allow, but not require, a signal-based override trigger for high-velocity projects.

## Context

Issue #2 surfaced this question during v1 planning: *Should `consolidate` cadence be cron-driven (weekly) or signal-driven?*

The `consolidate` skill merges redundant substrate entries, resolves conflicts between vocabulary and ADRs, and marks stale entries as superseded. It is a hygiene pass — it should run regularly even when no individual workflow triggers it.

Two trigger models were considered:

- **Cron-driven (weekly):** A scheduled job runs `consolidate` every week regardless of workflow activity. Predictable; ensures hygiene even when no workflow has completed recently.
- **Signal-driven:** The harness runs `consolidate` when a threshold is crossed — e.g., when the number of deferred-from-loop issues in GitHub exceeds N, or when a certain number of new substrate entries have accumulated. Responsive; avoids unnecessary runs in quiet periods.

The tension: cron is simple and predictable but may run when there is nothing to consolidate. Signal is responsive but requires the harness to observe and compute the signal, which adds complexity.

## Decision

Weekly cron is the default cadence. Signal-based override is a valid addition for high-velocity projects, but it is not required and is not the default.

The Yoke template shows weekly cron as the primary trigger. A commented-out example shows how to add a signal-based override (e.g., `when deferred-from-loop issues exceed 5`). Projects adopt the override by uncommenting and configuring; they get the default for free.

## Alternatives considered

**Cron-only (no signal override).** Would be simpler but prevents high-velocity projects from getting timely hygiene between weekly runs. A project shipping three features a week could accumulate substrate rot before the next cron fires. Rejected in favor of allowing the override.

**Signal-only (no cron).** Requires every project to define and configure the signal. Projects that don't configure it get no consolidation. The signal threshold is also project-specific (what count triggers it depends on team velocity). Rejected: too much configuration burden for adopters, and the hygiene guarantee disappears.

**Manual-only (no automation).** Suitable for hand-runners who follow the loop without a harness. Already supported — the theory and skill are harness-agnostic. But for automated workflows, manual-only means consolidation is forgotten. Not a viable default.

**Adaptive cadence (more frequent when entries grow fast).** Interesting but overengineered for v1. Requires the harness to track entry growth rate. Deferred.

## Consequences

- The Yoke template shows `consolidate` scheduled as a weekly cron with a commented example of signal-based override.
- High-velocity projects can add a signal trigger alongside the weekly cron (both triggers coexist — the signal fires when the threshold is crossed, the cron fires regardless).
- Projects that run the loop by hand run `consolidate` manually at the start of a new week or when they notice substrate drift — no harness configuration needed.
- Future projects that observe substrate rot between weekly runs have a documented, blessed path to tighten the cadence without modifying the skill.
