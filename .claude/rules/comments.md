---
paths: ['src/**', 'tests/**', 'e2e/**', 'scripts/**']
---

# Code comments

- A comment explains intent and rationale (why this approach, which trade-off), never what the
  code plainly does. Prefer a clear name over an explanatory comment.
- No milestone numbers, ticket ids, deadlines, or status in comments: code outlives them. A link
  to a permanent source (a label, a paper, a spec) is fine and expected next to numbers.
- When the code changes, change its comment. Exported functions, composables, and stores carry
  a doc comment that states the contract.
