# Reviewer index

| ID | Description | Category | Fires on | Path |
|---|---|---|---|---|
| security-sentinel | Flags OWASP top-10 violations, injection vectors, authentication flaws, and insecure credential handling in auth, API, and SQL-touching diffs. | security | auth/, api/, sql | ./security-sentinel.md |
| code-simplicity-reviewer | Flags YAGNI violations, premature abstractions, dead code, and readability issues in every diff. | quality | always | ./code-simplicity-reviewer.md |
| architecture-strategist | Evaluates system design decisions, component boundaries, and dependency direction whenever new source files are introduced. | architecture | new-files-in src/ | ./architecture-strategist.md |
