# ProjectFlow — Assessment Notes

## 1. System Understanding

### Architecture

ProjectFlow is an existing TypeScript monorepo. `apps/api` contains the NestJS API and MongoDB/Mongoose models; `apps/web` contains the Next.js App Router frontend. `packages/shared` supplies API types, enums and constants. pnpm workspaces and Turborepo coordinate builds. Existing modules cover authentication, users, organizations, organization membership, projects, project membership, tasks and comments. I extended these boundaries rather than replacing them.

### Backend Business Logic

Controllers translate HTTP input and delegate to services. DTOs validate input; services enforce business rules and query Mongoose models; schemas define persistence and indexes. `TasksService` owns task creation, assignment and activity access. `ProjectAccessService` centralizes project access. Response serializers explicitly select public fields rather than returning raw documents.

### Frontend / Backend Communication

Feature API helpers call `apps/web/src/lib/api-client.ts`, which supplies the base URL, bearer header, JSON handling and API errors. TanStack Query owns server state. Feature hooks and `query-keys.ts` define fetching and invalidation; React state holds transient controls such as member search text. Shared types describe responses but do not perform runtime response validation.

### Authentication & Authorization

The global `JwtAuthGuard` verifies bearer tokens and supplies authenticated identity; explicitly public authentication routes opt out. Authentication establishes who the caller is, not which project they may access. `ProjectAccessService` permits explicit project members or organization OWNER/ADMIN access; management additionally includes PROJECT_MANAGER. Services must call these checks before protected operations.

### Domain Relationships

Organizations own projects. OrganizationMember and ProjectMember connect users to organizations/projects with scoped roles. Projects own tasks; tasks have comments and now task activities. A task's `createdBy` identifies its creator, while nullable `assigneeId` references the responsible User. ProjectMember establishes assignment eligibility; its own row ID is not a User ID. Activities independently reference the task and acting user.

## 2. Key Risks & Observations

### Risk 1 — Missing status authorization

**Observation:** The original status endpoint authenticated callers but saved without checking project access.

**Why it matters:** An authenticated outsider could change another project's task status.

**Decision:** Fix now; corrected and regression-tested.

**Reason:** This was the reported security issue and took priority over optional improvements within the expected four hours / six-hour cap.

### Risk 2 — Count-based numbering

**Observation:** Task creation allocated `countDocuments + 1`.

**Why it matters:** Concurrent requests could choose the same number; deletion could cause reuse.

**Decision:** Fix now with an atomic project counter and compound uniqueness.

**Reason:** This directly affected required correctness. Retained-database migration remains an operational prerequisite, not something verified against production.

### Risk 3 — Dependent writes without an atomic boundary

**Observation:** Existing multi-write service operations provided no reusable transaction boundary for the new assignment/history pair.

**Why it matters:** Copying independent writes would allow assignment to succeed without matching history after a failure.

**Decision:** Fix the new assignment path now; leave unrelated project/comment write refactors for later.

**Reason:** One transaction addresses the required invariant without broad architectural change.

### Risk 4 — Route project context can differ from task context

**Observation:** Existing TaskView navigation/status handling uses the route's project ID, while task fetching uses task ID.

**Why it matters:** Mismatched URLs can produce incorrect navigation or cache invalidation. Copying that pattern into assignment could show the wrong member list.

**Decision:** Use canonical `task.projectId` for the new assignment flow; defer existing navigation/status cleanup.

**Reason:** Protect the new feature's scope without unrelated UI refactoring. Backend authorization always remains independent of route assumptions.

## 3. Task Assignment

`Task.assigneeId` is a nullable User ObjectId, serialized as a string or null in `TaskDetail`. New tasks default to null; legacy missing fields also serialize as null. Creator, number, status and priority retain their existing meaning.

`PATCH /tasks/:taskId/assignee` accepts a valid User ID or explicit null. Omission, invalid types/IDs and extra properties are rejected. Every non-null target must exist and be an explicit member of the task's project, including targets selected by elevated actors.

Organization OWNER/ADMIN and project PROJECT_MANAGER can assign other eligible members and clear assignments. A regular project member can self-assign, clear their own assignment, or request an already-null no-op. I interpret authorized unassignment for regular members as own-assignment removal; they cannot clear someone else's assignment. The service validates actor policy and target membership before returning a no-op, so repeated requests cannot bypass permissions. No-op requests create neither a task write nor an activity event.

## 4. Authorization Decisions

The loaded task's stored `projectId` is the security scope. Assignment checks actor access, role and target membership in the transaction. Status mutation now checks existing view access before changing or saving status. General task editing retains its additional creator/manager rule; deletion retains management authorization.

Unauthorized cross-project calls return 403. OWNER/ADMIN access without an explicit project membership is an intentional existing policy, not the outsider bypass. Frontend permission controls improve usability; the backend remains authoritative even if a caller bypasses the UI.

## 5. Activity History

`TaskActivity` uses collection `task_activities` with `taskId`, `actorId`, type `TASK_ASSIGNEE_CHANGED`, nullable `metadata.from`/`metadata.to`, and timestamps. It records null→user, user→different user and user→null. Actor and target are separate identities; unchanged assignments produce no event.

### Atomicity

`TasksService.updateAssignee` saves the task assignment and inserts an event in the separate TaskActivity collection sequentially within one MongoDB multi-document transaction, using the same session. Both commit together or neither does. The rollback test rejects activity persistence with a disposable database validator and verifies the complete task document is unchanged and history empty. A successful response is returned only after transaction commit; activity-write failure rolls back the assignment. Response serialization happens after commit; a lost response does not imply rollback, which is why the client refetches after uncertain failures. This is a database transaction, not an end-to-end exactly-once delivery guarantee.

## 6. Activity API

`GET /tasks/:taskId/activity` first requires JWT authentication, then authorizes project access using the stored `task.projectId`. It returns `{items, total, page, pageSize}`; defaults are page 1 and pageSize 25, with maximum pageSize 100. Invalid paging is rejected.

Results sort by `createdAt DESC, _id DESC`, giving a deterministic tie-break for equal timestamps. The index `{taskId:1, createdAt:-1, _id:-1}` supports the task filter and ordering. Offset pagination fits the current contract.

The service deduplicates actor/from/to User IDs across the page and performs one batched `$in` user lookup, not one query per activity. Missing users retain their IDs with an Unknown user summary; null references remain null. User summaries expose only id, name, email and avatarUrl. Events are not dropped when enrichment is missing.

## 7. Frontend Assignment & Activity UI

### Assignee Selector

`TaskAssigneeSelect` fetches members for canonical `task.projectId`. A separate search input filters loaded names/emails. Existing Select/Button/Label primitives provide loading, disabled, error/retry and empty states. Role-based controls avoid obviously forbidden choices, but do not replace server checks. Options submit `entry.user.id`, not the membership-row ID.

### Server State Strategy

There is no optimistic assignee update. I chose server-confirmed updates:

1. Send the assignment PATCH and disable conflicting interaction while pending.
2. Wait for success and install the returned `TaskDetail` in the task cache.
3. Update the canonical task query directly with that response; invalidate the canonical project's task list and task activity prefix. The successful path does not separately invalidate task detail.
4. On uncertain network or 5xx failure, invalidate/refetch canonical task detail and related project/activity caches.

Ordinary 4xx responses keep the previously confirmed value. This avoids inventing a task/event state that permissions or persistence may reject. The brief permits another well-designed strategy instead of optimistic rollback; a single assignment control benefits from this simpler, explicit confirmation model.

### Activity Timeline

`TaskActivityTimeline` renders assignment, reassignment and unassignment text from server actor/from/to data, using the existing date formatter. Unknown users remain visible. Button-driven Load more requests server pages, preserves returned order and removes overlapping IDs without client sorting. Events use stable activity IDs as keys. Loading, empty, error/retry and denied-access states remain local to the section. Manual browser smoke success is candidate-reported; no browser automation pass is claimed.

## 8. Production Bug Investigation

### Reported Issue

“Some users appear to be able to modify tasks belonging to projects they are not members of.”

### Reproduction

In disposable pre-fix data, an authenticated organization MEMBER belonged only to Project B. A status PATCH against Project A's task returned HTTP 200 and persisted TODO→IN_PROGRESS. The same outsider's GET, general PATCH and DELETE returned 403 without changing the task.

### Root Cause

`JwtAuthGuard` authenticated the request, but the status controller did not forward authenticated identity to the service. `TasksService.updateStatus()` therefore loaded by ID and mutated/saved the task without checking project authorization. GET, general PATCH and DELETE already had access checks; the reproduction did not show the same bypass on those routes.

### Impact

A non-elevated outsider with a task ID could change that task's status. Evidence does not show general editing, deletion or task reading bypasses.

### Fix

The controller forwards `CurrentUser('id')`; `updateStatus` checks the stored task's project before assignment/save. Commit: `c765dcc`.

### Regression Prevention

The test `denies task mutations by a same-organization member of another project without changing persistence` in `apps/api/test/tasks.e2e.spec.ts` asserts HTTP 403 for status/general PATCH/DELETE and compares complete raw database documents before/after. It verifies both HTTP denial and unchanged persistence. Positive member/OWNER/ADMIN cases verify persisted status and unchanged creator. See [BUG_REPORT.md](BUG_REPORT.md) for reproduction details.

## 9. Concurrent Task Creation

The original `countDocuments() + 1` allocation was race-prone: two requests could observe the same count and allocate the same next number. Deleting a task also made count an unreliable high-water mark.

`Project.lastTaskNumber` defaults to zero. After authorization, creation atomically increments it with `$inc` and uses the returned value. The unique task index `{projectId:1, number:1}` protects the invariant independently of allocation. Each project has its own counter, so different projects may share number 1. Deletion and failed task inserts do not decrement it; gaps are intentionally accepted.

Seed/raw task fixtures use `$max` to avoid lowering counters. Before rollout to existing retained databases, initialize/reconcile counters against existing numbers and inspect/resolve duplicates. Replace the existing nonunique task-number index with the unique compound index if present. No formal migration framework currently exists. Fresh disposable-database verification does not establish that migration is complete.

## 10. Testing Strategy

Tests in `apps/api/test/tasks.e2e.spec.ts` use real Nest requests, JWTs and MongoDB. I prioritized permission boundaries and persisted invariants rather than a coverage percentage.

| Official minimum                       | Concrete coverage                                                      |
| -------------------------------------- | ---------------------------------------------------------------------- |
| Member self-assignment                 | Noncreator member assigns and clears their own assignment              |
| Authorized role assigns another member | Parameterized OWNER/ADMIN/PROJECT_MANAGER cases                        |
| Regular member cannot assign others    | Forbidden assignment/clear cases with unchanged task/history           |
| Outside-project target rejected        | Nonmember, elevated nonmember and other-project targets                |
| Assignment creates history             | Assignment/reassignment actor and from/to assertions                   |
| Unassignment creates history           | Previous user→null, persisted state and refreshed history              |
| Unauthorized task mutation denied      | Same-organization outsider status/edit/delete with raw DB equality     |
| Concurrent creation remains unique     | 20 parallel requests; two independent projects; persisted numbers/keys |
| Unauthorized history access denied     | Anonymous 401 and outsider 403 without history payload                 |

Additional coverage includes no-ops, malformed input, membership-row ID rejection, rollback, concurrent assignment consistency, pagination boundaries, equal timestamps, missing users, exact safe user fields and actual index presence. Deleted-number non-reuse is also tested.

E6 strengthened assignment/unassignment persistence, null from/to transitions and canonical refresh assertions, and added an actual activity-index check. Existing missing-user, pagination/order/tie, task-scoping, no-op and rollback assertions were retained and rerun; they were not all newly added during E6.

The latest fresh root run, `pnpm test --force`, passed **4 suites / 50 tests / 50 passed**, with zero failed/skipped, in 101.848 seconds of Jest time. It used the existing disposable MongoMemoryReplSet setup. The E6 assertion enhancements are now committed in `8a08ab8`.

## 11. Database & Transaction Topology

The API's transactional assignment flow requires a transaction-capable MongoDB topology, such as a replica set or sharded cluster. A reachable standalone MongoDB is insufficient. Earlier checks used disposable Docker single-node replica sets. Final E6 verification used the repository's unchanged `MongoMemoryReplSet` setup/teardown with MongoDB 8.2.6 and wiredTiger. This proves the tested local transaction path, not production topology, failover or availability. README documents the local replica-set recipe and this deployment prerequisite.

## Code Review

This reviews the supplied `assignTask(taskId, assigneeId, userId)` example, which loads a task/user, sets `task.assignee`, saves and returns the document. I would request changes before approval, rather than rewrite it for style.

### Correctness

Checking task and user existence is useful, but the example uses `assignee` rather than this repository's `assigneeId`. It lacks explicit clearing and no-op semantics and returns a raw document instead of the established TaskDetail contract.

### Authorization

`userId` is unused. Neither actor project access nor assignment permission is enforced. Authenticate at the boundary and authorize against the loaded task's stored project through the existing access service.

### Business Rules

User existence does not establish project membership. The function does not distinguish elevated roles from a regular member restricted to self-assignment. Target membership, own-assignment clearing and no-op revalidation need explicit policy.

### Data Consistency

It writes no history. Adding a second independent insert would still allow partial persistence. Assignment and its matching event need one atomic transaction with rollback behavior tested.

### Security

Without scoped checks, a caller can target tasks or users across projects. Raw document responses also risk exposing internal fields; use the established serializer.

### Performance

Two sequential reads are not the principal defect. Correct scoped validation comes first; select only necessary data and avoid introducing per-record enrichment queries when history is listed. Optimize measured query costs, not the function's line count.

### Error Handling

NotFound covers missing entities but not forbidden actors, invalid identifiers or ineligible targets. Follow existing validation/HTTP conventions and let persistence failures surface without claiming a successful assignment.

### Maintainability / Architecture

Keep policy in the service layer and reuse ProjectAccessService and membership services. Do not duplicate role logic in the controller or introduce a new architecture for this operation.

**Changes I would request before approval**

1. Enforce actor access/role and target membership using stored task scope.
2. Use the existing assigneeId/TaskDetail contract with explicit null and validated no-ops.
3. Persist assignment and history atomically.
4. Add focused permission, transition and failure/persistence tests.

## 12. Scaling the Activity System

Growth from 5,000 to 500,000 users would justify changes based on event volume and measured workloads, not user count alone.

### Indexes

The current taskId/createdAt/\_id index matches task history reads. Monitor explain plans, examined-versus-returned rows, index size and write cost. Add indexes only for demonstrated new query patterns; every extra index consumes memory/storage and slows writes. If task/tenant traffic becomes uneven, measure that distribution before considering partitioning or sharding.

### Data Growth & Retention

Measure events per day, bytes per event and storage growth, and agree a retention policy with product/audit stakeholders. History may be needed for investigation, so automatic deletion is not a default. Bounded retention lowers cost but reduces historical visibility; policy must distinguish interactive history from records that must be preserved.

### Pagination

Offset pages are simple today. When deep-page latency or shifting boundaries become significant, introduce a cursor based on the same createdAt/\_id ordering, scoped to the authorized task. Seek queries avoid scanning increasingly large offsets and reduce overlap from new inserts. The tradeoff is losing convenient arbitrary page jumps and changing the client contract. Exact total counts may also become optional if their cost is material.

### Archiving

If old events dominate storage but are rarely read, move them in bounded batches to a cheaper archive with an explicit retrieval path. Preserve IDs, ordering and audit metadata, and verify completeness before removing hot copies. Restore latency and a more complex query experience are the cost of smaller hot indexes. Archiving must follow retention rules rather than silently hide history.

### Background Jobs / Queues

Large exports, archival batches, notifications and derived summaries can run asynchronously when their latency or volume interferes with requests. Jobs need bounded retries, idempotency and failure visibility. I would not move the authoritative activity insert outside the current transaction: that would weaken the required invariant. Reliable downstream delivery would need a durable handoff design if product requirements justify it; no queue is needed merely to render today's timeline.

### Real-Time Updates

If collaborative usage requires immediate changes from other sessions, publish post-commit invalidation hints over a scoped WebSocket/event channel. Reauthorize subscriptions and refetch canonical API data after reconnect. This improves freshness but introduces connection management, ordering/replay and delivery concerns; event delivery should not become the source of truth.

### Caching

Cache read pages or user summaries only when repeated reads demonstrate value. Keep authorization checks and transactional writes authoritative. Invalidate affected history after commit, use bounded lifetimes for enrichment, and avoid sharing cached data across unauthorized scopes. Older immutable event pages are easier to cache than the changing first page, but names and membership can still change. Extra cache coordination is a tradeoff, not a free optimization.

### Observability

Track activity-query latency by page depth, rows examined, total-count cost, write/transaction latency, abort/retry rates, DB resource pressure and eventual job backlog. Correlate requests with structured logs/traces without tokens or unnecessary personal data. Alerts should distinguish expected policy denial from persistence failures.

### Evolution Strategy

First establish metrics and representative load tests. Then address the measured bottleneck: cursor paging for deep scans, retention/archiving for old-data growth, caching for repeated reads, and asynchronous work for expensive secondary effects. Validate each change against permission and consistency tests. This sequencing preserves the existing architecture until evidence warrants additional operational complexity.

## 13. Scope Decisions

### Implemented

Status authorization fix; atomic project numbering and uniqueness; assignment permissions/target validation; transactional activity; authorized paginated history and batched enrichment; searchable selector; server-confirmed mutation recovery; readable timeline; regression and integrated tests.

Some activity persistence and failure-atomicity work originally planned as separate test/verification items was implemented and tested as part of the assignment mutation itself. Because the selected architecture uses one MongoDB transaction for task state and activity persistence, separating these items would have duplicated implementation and verification rather than adding meaningful coverage. This work was completed in E3-S2, not deferred.

### Intentionally Deferred

Production retained-data migration execution, broader unrelated write atomicity, existing route-context cleanup, deeper browser automation, cursor pagination, retention/archiving and real-time updates. No deployment or production load benchmark was performed.

### Why

The brief expects four hours with a six-hour hard cap. I prioritized authorization, durable correctness and focused tests over new infrastructure and unrelated polish. These are prioritization decisions, not a claim about actual elapsed time. The Jira total of 295 minutes (4h55m) is a planning estimate, not actual elapsed time.

> Actual candidate time: approximately 7 hours across two working sessions.

## 14. Verification Summary

- **Automated:** the latest fresh root test run passed 50/50 across four suites using real disposable replica-set setup. API and web typecheck/lint/build passed; test TypeScript and diff whitespace checks passed.
- **Integrated:** HTTP project/task creation, counter default, assignment, forbidden mutations, history enrichment, unassignment and canonical refresh passed in the existing harness.
- **Persistence:** Parallel numbering, project isolation, deleted-number non-reuse, concurrent assignment consistency and forced activity-write rollback passed. Both required compound indexes were checked against MongoDB.
- **Manual:** Frontend static checks passed. Browser smoke testing was manually performed by the candidate and reported as successful. No automated browser verification or clean-machine run is claimed.
- **Scope of evidence:** implementation HEAD is `8a08ab8` (`test: verify assignment activity integration and persistence`). Commit `2aaf9a8` included the missing frontend components; `08d5ad5` fixed cross-platform dev-port handling. The reviewed test changes are committed. No tests were rerun for this documentation-only task.

Focused E5/E6 changed-file formatting checks passed. The broader checks recorded by E6 still reported failures in replica-set setup/teardown and six pre-existing, unchanged starter components; they were not a complete repository-wide formatting pass. These are formatting findings, not evidence of a production runtime failure. I would not mass-format unrelated starter code merely to make the broader check green.

### AI usage and Git history

I used OpenAI Codex for assisted exploration, implementation, test refinement and
review; [AI_LOG.md](AI_LOG.md) distinguishes assistance, candidate responsibility
and actual verification. Rejected suggestions and exact prompts are not invented.
History separates authorization (`c765dcc`), atomic numbering (`1d22f4f`),
transactional assignment (`ba0504d`), activity API (`31abeb3`), frontend packaging
(`2aaf9a8`), dev portability (`08d5ad5`) and integrated tests (`8a08ab8`).
Authorization regression tests are included in the fix commit; absence of an
exact example test-commit title does not mean those tests are missing.

## 15. Known Limitations

- Transaction-capable topology is a deployment prerequisite; production infrastructure was not verified.
- No formal migration framework exists. Existing retained databases require counter initialization/reconciliation and index review/migration before rollout; duplicate repair is needed if duplicates are present.
- Offset paging can shift under concurrent inserts and becomes expensive at depth.
- No live activity stream or frontend browser automation suite was added. Redis, Kafka and queue infrastructure were not required and were not introduced.
- Broader formatting checks retain pre-existing/unchanged failures; unrelated starter reformatting remains outside scope.
- Actual candidate elapsed time must be filled in before submission.
- Root `pnpm dev` was verified in Windows Git Bash at default web port 3742 and override 3800, with API on 4732. Unix/macOS/Linux and clean-machine setup were not verified. The separate production web `start` script retains shell-specific syntax.
- Local reports are historical evidence and are not all committed submission artifacts.

## If I Had Two More Days

1. **Operational readiness:** rehearse retained-data counter/index migration, backup/rollback and documented replica-set startup on a clean machine. Prevent deployment failures before adding features.
2. **Frontend regression coverage:** automate assignment success/failure, refresh, pagination and keyboard/narrow-layout behavior. Protect the client/server boundary currently covered mainly by API tests and manual smoke evidence.
3. **Measured activity scaling:** add representative load measurements and query/transaction observability; introduce cursor paging or a retention/archive policy only where those measurements and product needs justify them.
