# Commit History Patterns

## Typical Commit Behavior
- Frequent small commits around vertical slices.
- Explicit migration commits before feature rollouts.
- Separate commits for observability and rollback safety.

## Review Habits
- Bias toward readability and instrumentation.
- Prefer incremental changes over all-at-once rewrites.
- Add guardrails when touching critical paths.
