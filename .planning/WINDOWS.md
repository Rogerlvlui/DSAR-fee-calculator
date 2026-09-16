---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-09-16T04:40:04.058Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 03 | unmet-truth | packages/schemas/src/json-schema.test.ts |  | Pre-existing CRLF/LF drift test failure (committed assessment.schema.json has CRLF, regenerated output is LF) - confirmed pre-existing via git stash, unrelated to plan 03-01 | open |  | 2026-09-16T04:40:04.058Z |  |

````json
[
  {
    "id": 1,
    "kind": "unmet-truth",
    "phase": "03",
    "file": "packages/schemas/src/json-schema.test.ts",
    "line": null,
    "description": "Pre-existing CRLF/LF drift test failure (committed assessment.schema.json has CRLF, regenerated output is LF) - confirmed pre-existing via git stash, unrelated to plan 03-01",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-09-16T04:40:04.058Z",
    "resolved_at": null
  }
]
````
