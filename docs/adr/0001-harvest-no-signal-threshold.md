---
id: harvest-no-signal-threshold
type: adr
description: Harvest uses LLM judgment via falsifiable trigger questions, not a configurable numeric threshold
created: "2026-05-01"
status: accepted
tags:
  - harvest
  - substrate
  - skill-interface
---

## Summary

The `harvest` skill must decide when a workflow has surfaced nothing worth adding to the substrate. This ADR records the decision not to expose a configurable numeric threshold and to rely instead on LLM judgment via the falsifiable trigger questions already in the skill's procedure.

## Context

Issue #2 surfaced this question during v1 planning: *Should the `harvest` no-signal refusal threshold be tunable per project?*

The concern was that different teams have different signal densities. A fast-moving team might want a stricter threshold to avoid substrate noise; a slower team might accept lower signal. A configurable parameter (e.g. `min_entries: 2`) could encode this.

The `harvest` skill's trigger is already implemented as a set of four falsifiable yes/no questions the LLM applies to the workflow trace:

1. Was a domain term used without a definition in the substrate vocabulary?
2. Was a non-obvious architectural choice made that future agents or maintainers would need context for?
3. Did an agent over-build in a pattern that would recur and harm future workflows?
4. Was a problem solved in a reusable way that another workflow might face?

If none of the four answer "yes", the skill writes zero entries and stops.

## Decision

LLM judgment via the existing falsifiable trigger questions is sufficient. No configurable threshold is introduced.

The trigger questions already act as a threshold: they ask whether real signal was surfaced, not whether the signal meets an arbitrary count. Adding a numeric parameter (`min_entries`, `signal_threshold`) would add harness complexity — another value to document, another edge case (what does `min_entries: 0` mean?), another source of drift between teams — without measurable benefit. The falsifiable questions are the threshold.

## Alternatives considered

**Configurable numeric threshold (`min_entries: N`).** Rejected. Introduces a tuneable with unclear semantics. "0 entries" is already the correct outcome when nothing was surfaced; requiring at least N entries would pressure agents to invent entries to meet a floor, which harms substrate quality.

**Mandatory minimum entries per workflow.** Rejected. Same problem as above. Some workflows genuinely surface nothing new. Forcing an entry per workflow fills the substrate with noise.

**Heuristic scoring (e.g., each trigger question contributes a weight).** Rejected. Overcomplicates the judgment without adding reliability. The four binary questions already decompose the decision; scoring them independently would re-introduce calibration as a harness concern.

## Consequences

- The `harvest` skill interface remains simple: trigger, inputs, outputs, no configurable parameters exposed to the harness.
- Teams that want a stricter policy (e.g., never write vocabulary unless the term appears in at least two slices) encode it in their own harness prompt or in a custom fork of the skill, not in the skill's public interface.
- The falsifiable trigger questions are the normative mechanism. Any change to the threshold policy is a change to those questions, not a new parameter.
