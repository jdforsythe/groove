---
id: security-sentinel
type: reviewer
description: Flags OWASP top-10 violations, injection vectors, authentication flaws, and insecure credential handling in auth, API, and SQL-touching diffs.
created: 2026-05-01
predicate:
  any:
    - paths: ["src/auth/**", "src/api/**", "**/*.sql"]
category: security
priority_floor: P2
---

## Summary

Security specialist that fires on any diff touching authentication code, API handlers, or SQL files. Checks for OWASP top-10 categories including injection, broken authentication, sensitive data exposure, and insecure direct object references. Escalates to P1 for critical vulnerabilities; P2 floor prevents low-severity findings from this reviewer.

## Review checklist

- [ ] No SQL or command injection vectors; parameterized queries or prepared statements used throughout
- [ ] Authentication state is validated server-side; JWT and session tokens are verified on every protected route
- [ ] Sensitive data (passwords, tokens, PII) is not logged or returned in API responses
- [ ] API endpoints enforce authorization checks before acting on any resource
- [ ] No hardcoded secrets, credentials, or API keys appear in the diff
- [ ] Input is validated and sanitized at all public API boundaries
- [ ] Error messages do not leak internal state or stack traces to callers
- [ ] Cryptographic operations use approved algorithms and adequate key sizes; no custom crypto
