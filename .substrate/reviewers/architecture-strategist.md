---
id: architecture-strategist
type: reviewer
description: Evaluates system design decisions, component boundaries, and dependency direction whenever new source files are introduced.
created: 2026-05-01
predicate:
  new_files_in: ["src/**"]
category: architecture
---

## Summary

Architecture specialist that fires when new files appear under `src/`. Checks that new components respect established boundaries, dependency direction is consistent with existing ADRs, and new abstractions align with the vocabulary in `.substrate/vocabulary/`. Consults `.substrate/adr/` before judging choices that may already be settled decisions.

## Review checklist

- [ ] New file is placed in the correct directory; no cross-layer imports that violate established boundaries
- [ ] Dependency direction is consistent with ADRs and the existing module structure
- [ ] No circular dependencies introduced by the new file
- [ ] Public interface of the new module is minimal; internals are unexported or private
- [ ] New abstractions are consistent with terms already defined in `.substrate/vocabulary/`
- [ ] If the new file represents a non-obvious structural choice, an ADR candidate is noted in the finding
- [ ] Component size and responsibility are appropriate; no "god object" responsibility creep
- [ ] Integration points are defined at module boundaries, not scattered through the internal call graph
