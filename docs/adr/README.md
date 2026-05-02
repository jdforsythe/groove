# Architecture Decision Records

Domain-level decisions for the Groove repository itself. One file per decision.

| ID | File | Description | Status |
|---|---|---|---|
| 0001 | [0001-harvest-no-signal-threshold.md](0001-harvest-no-signal-threshold.md) | Harvest uses LLM judgment via falsifiable trigger questions, not a configurable numeric threshold | accepted |
| 0002 | [0002-consolidate-cadence.md](0002-consolidate-cadence.md) | Consolidate runs on weekly cron as the default, with signal-based override as an optional addition | accepted |
