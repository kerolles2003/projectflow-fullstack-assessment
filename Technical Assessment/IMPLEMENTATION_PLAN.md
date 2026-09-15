# Implementation Plan

Planning only, 2026-09-15. The authoritative specification remains `Technical Assessment/ET-Fullstack-Assessment-ProjectFlow.md`; section references below refer to that file. All existing locations were inspected. Proposed paths/routes/fields are explicitly future work. No application implementation, assessment tests, final deliverables, dependencies, or commits are created in this phase. See `CODEBASE_MAP.md` for current architecture and evidence limits.

Each numbered requirement uses the requested fields. Paths are repository-relative; when a cell abbreviates a sibling path, it retains the directory context of its first full path.

## Execution Budget and Scope

This revision changes only this plan. All implementation actions below are future work, requiring a later implementation instruction. The brief's expected effort is **4 hours**, with a **6-hour hard cap**. Track actual cumulative assessment effort, including applicable prior exploration/planning; do not silently reset the clock when coding starts. Prior elapsed effort is not established here.

| Major phase | Approximate range | Priority / exit evidence |
| --- | --- | --- |
| Baseline and bug reproduction | 20–30 minutes | Record existing worktree state without resetting it; run baseline checks in isolation and verify unauthorized persisted status change before calling the issue reproduced. |
| Authorization fix and regression tests | 30–45 minutes | Denied mutations leave data unchanged; intended member and OWNER/ADMIN access remains. |
| Concurrency-safe numbering | 35–50 minutes | Database allocation, unique project/number index, compatible seed/fixtures, parallel successful creates with unique identifiers. |
| Assignment and activity backend | 60–75 minutes | Resolve consistency gate first; implement policy then activity, with all-or-nothing persistence. Do not expose an assignment-only intermediate implementation. |
| Activity API and tests | 25–35 minutes | Authorized paging, newest-first ordering, matching index, batched user enrichment. |
| Frontend assignment and timeline | 45–60 minutes | Core selector/history, paging, permission states, accessible keyboard use, and server-confirmed refresh. |
| Documentation and final verification | 30–45 minutes | Required deliverables, review/scaling/reflection, check results, and complete diff review. |

The requested ranges total **245–340 minutes (4h05–5h40)** before prior effort. They are estimates, not permission to extend the cap or a promise of four-hour completion. Aim for the low end, complete tests alongside each backend change, and capture documentation evidence as work happens so the final phase is consolidation. Reuse verified reconnaissance instead of repeating it. Reforecast after each phase; any prior effort reduces the remaining allowance. The high end leaves only 20 minutes for contingencies if there is no prior effort.

- **Approaching 4 hours:** stop nonessential polish; prioritize correctness, security/concurrency tests, core UX, and required documentation. Reassess unfinished scope explicitly.
- **Approaching 5 hours:** defer nice-to-have frontend/test refinements. Reserve the final 30–45 minutes for documentation, required-test completion, final checks, and diff review; do not start work that consumes this reserve.
- **At 6 hours:** stop. Report incomplete requirements and failed/unrun checks honestly; do not label an unsafe or unverified feature complete. Never trade required backend/security tests for polish.
- Once required behavior works, do not begin unrelated refactoring. The time constraint may require documented incompleteness; it does not permit claiming requirements were met when they were deferred.

**In scope:** production authorization investigation/fix, assignment and its permissions/membership/unassignment rules, consistent assignee history, authorized/indexed/paginated activity with N+1 prevention, minimal selector/timeline, concurrency-safe numbering, required tests, code review, scaling discussion, and required documentation.

**Deferred observed risks:** existing comments pagination and full task-list pagination redesign; JWT refresh/revocation; application-wide transactions; unrelated error-handling rewrites; global caching; Docker without a concrete setup need; microservices, Kafka, outbox, and event sourcing. RISK_REGISTER entries are evidence for prioritization, not automatic implementation mandates. Fix adjacent code only when necessary for the requested feature's correctness (for example counter-aware fixtures or canonical task project context).

## Selected Policies and Consistency Gate

These are reasoned implementation decisions, not claims that the brief explicitly specifies every detail. New routes/fields remain proposed implementation surfaces until created.

- **Assignment:** use nullable User-reference `assigneeId` and a dedicated proposed `PATCH /tasks/:taskId/assignee`; require the property on that endpoint. Explicit null clears; omission is a validation error, never an implicit clear. Existing tasks without the field serialize as unassigned. Create-time assignment is deferred; creation remains unassigned. Preserve createdBy.
- **Actor and target:** OWNER/ADMIN in the task's organization and PROJECT_MANAGER in its project may assign others. Project MEMBER may assign themselves, including tasks created by others. Every non-null target, even OWNER/ADMIN, needs explicit membership in the task's project. An actor's elevated access does not waive target membership. Denied actors receive 403; an authorized actor's ineligible target receives 400.
- **Unassignment assumption:** OWNER/ADMIN/PROJECT_MANAGER may clear any task they can manage; MEMBER may clear only their own assignment. An already-null request by an actor with project access is an idempotent no-op with no event. Repeating the current assignment also creates no event; no-op handling does not bypass access or target policy checks.
- **Status decision:** use `ProjectAccessService.assertCanView(task.projectId, userId)` for status mutation. Reinspection confirms this accepts explicit project members or organization OWNER/ADMIN. This is the smallest project-access fix and matches the existing selector shown to task viewers; creator-or-manager restrictions on general PATCH and management-only DELETE stay unchanged. The brief does not explicitly require the stricter general-edit policy for status. Reproduce the missing-check issue in a disposable database before describing it as runtime-confirmed.
- **Display/API defaults:** offset paging using the existing contract, deterministic newest-first order, live batched user summaries with an Unknown user fallback retaining original IDs/events, and existing date formatting initially. Use the canonical returned task.projectId for member queries, assignment context, and cache invalidation.
- **Frontend updates:** retain server-confirmed mutations. Update detail from the successful response and invalidate relevant project-task/activity pages. Keep the last confirmed UI state on failure and show an error; if the response is lost after commit, refetch canonical state rather than claiming the database rolled back. Add optimistic state only if concrete implementation evidence makes this strategy inadequate.

**Activity consistency invariant:** an assignee change and its matching event must persist together. A success response must never intentionally represent a change without history; returning an error after a separate task save does not repair that inconsistency.

**Decision gate, before assignment implementation:** inspect the actual available Mongo topology and test setup within the backend phase budget. `apps/api/test/global-setup.ts` currently uses standalone `MongoMemoryServer`; `AppModule` only supplies a URI and does not prove replica-set support. Prefer a separate activity collection with a transaction if a supported local/test replica set can be provided simply. If selected, use the existing mongodb-memory-server package's replica-set fixture with matching teardown, document the minimal development setup/URI requirement, and avoid refactoring unrelated writes. Read previous assignee, recheck mutation policy, update task, and insert event within the same session/transaction; use bounded transaction retries so a conflict recomputes from/to and authorization instead of recording stale history. Return success only after commit. Verify forced event-write failure leaves both task and history unchanged.

**Smallest safe fallback if transactions are impractical:** explicitly select embedded assignee events on Task, updating assignee and appending the event in one conditional single-document write. Match the previously read assignee (including legacy missing/null); on mismatch reload and re-evaluate policy, retry boundedly or return conflict without a write. Give events IDs/timestamps and page newest-first within the authorized task. This trades a separate `(taskId,createdAt,_id)` activity index for the task `_id` lookup and bounded response slicing; document that it cannot independently index/page a growing event stream and grows toward MongoDB's document-size limit. Never truncate required history silently. This is only a small-assessment fallback if its indexed task lookup/paging trade-off is justified against brief §08; retain a separate indexed collection with transactions when feasible. No eventual dual-write, compensation-only approach, outbox, or distributed infrastructure is the default. Record the evidence and selected branch before coding; the per-requirement separate-collection/index proposal below applies to the preferred branch.

## Test Priority Tiers

The following tiers govern the test suggestions in all 24 requirements; a per-requirement “Tests Required” field is not a mandate to implement every suggested variant. Required behavior (including paging, no-op handling, and accessible core UX) remains required even when exhaustive automation is deferred.

**Must have, exercise HTTP authorization and real isolated persistence where practical:**

- Member self-assignment, including a task created by another user.
- Authorized elevated role assigning another project member; cover OWNER, ADMIN, and PROJECT_MANAGER compactly with parameterized cases.
- Regular member cannot assign another member; nonmember target rejected.
- Authorized unassignment and member restriction against clearing someone else's assignment.
- Assignment, reassignment, and unassignment each create the correct actor/from/to activity.
- Unauthorized activity access denied.
- Unauthorized task mutation regression, including status/general PATCH/DELETE and unchanged persisted state after denial; positive intended access cases.
- Parallel task creation succeeds with unique project-specific identifiers; verify project isolation and persisted uniqueness rather than only response values.
- Persistence-strategy correctness check: injected activity-write failure cannot leave an assignee-only change (or equivalent single-write failure test for the fallback). This protects the explicit consistency invariant.

**Strongly recommended:** no-op assignment produces no activity; activity pagination boundaries; deterministic newest-first ordering; missing-user activity fallback; creator unchanged after assignment. Add a compact concurrent assignment case if needed to validate the selected conflict handling.

**Nice to have if time allows:** detailed frontend interaction automation, exact query-count assertions, additional equal-timestamp edge cases, extended responsive UI automation. Inspect batched query code and matching indexes even if exact query-count tests are deferred. Perform a short manual core-UX check without introducing a large frontend test harness.

## Requirement

1. Task assignment (brief §05)

## Existing Location

`apps/api/src/tasks/schemas/task.schema.ts::Task`, `tasks.service.ts::update/toSummaries/toDetail`; `packages/shared/src/api.ts::TaskSummary/TaskDetail`.

## Current Behavior

Tasks have createdBy but no assignee; existing general edit is creator-or-manager only.

## Required Change

Add a nullable assignee consistent with ObjectId references and public user summaries. Keep createdBy, status, and priority meanings intact; treat absent legacy values as unassigned.

## Backend Impact

Implement assignment in TasksService using membership/access services; add the necessary module imports and validated DTO.

## Database Impact

Proposed `assigneeId` references User; eligibility is verified via ProjectMember. Existing tasks need compatible null serialization.

## API Impact

Prefer a dedicated `PATCH /tasks/:taskId/assignee` with `{assigneeId: string|null}` and TaskDetail response; this is a proposal, not an existing route.

## Frontend Impact

Extend task types and add selector/mutation integration in existing task detail.

## Authorization Impact

Do not reuse the general edit gate blindly: self-assignment must work for members who did not create the task.

## Tests Required

Member self-assignment on another creator's task; legacy missing field; malformed/nonexistent IDs; correct creator retention.

## Documentation Required

Record chosen field/route and legacy behavior in future README/ASSESSMENT_NOTES.

## Risks / Edge Cases

Membership-row ID differs from user ID; unknown DTO fields currently fail validation.

## Decision Needed

Selected: User reference plus explicit project-membership validation, dedicated assignment endpoint, legacy null serialization. Create-time assignment is deferred because the brief requires the task details selector, not a creation-form expansion.

---

## Requirement

2. Assignment permissions (brief §06)

## Existing Location

`apps/api/src/projects/project-access.service.ts::canManage/assertCanView`; `tasks/tasks.service.ts::update`; `packages/shared/src/roles.ts`.

## Current Behavior

OWNER/ADMIN are organization roles; PROJECT_MANAGER/MEMBER are project roles. General PATCH requires creator or manager.

## Required Change

After actual-project access, allow OWNER, ADMIN, PROJECT_MANAGER to assign project members; regular members may target only themselves.

## Backend Impact

Centralize assignment policy in the task service path, separate from unrelated field-edit policy.

## Database Impact

Resolve roles from current memberships, not token claims.

## API Impact

Return appropriate 403 for denied actor actions; do not accept actor identity from request body.

## Frontend Impact

Show eligible actions from current user, organization role, and project membership.

## Authorization Impact

Preserve elevated organization access without requiring actor project membership; all targets still require explicit membership.

## Tests Required

Exercise OWNER, ADMIN, PROJECT_MANAGER, MEMBER, organization-only member, and cross-organization actor.

## Documentation Required

Explain actor scope versus target eligibility in ASSESSMENT_NOTES.

## Risks / Edge Cases

Creator privilege must not accidentally permit assigning another user.

## Decision Needed

Recommend preserving existing elevated access; distinguish that policy from the reported bug.

---

## Requirement

3. Project membership restriction (brief §06)

## Existing Location

`apps/api/src/project-members/project-members.service.ts::findExisting/findRole`; `projects/projects.service.ts::findMembers`; membership schema.

## Current Behavior

Project/user pairs are unique; project access can exist without explicit membership.

## Required Change

Validate target membership against stored task.projectId on every assignment.

## Backend Impact

Inject ProjectMembersService explicitly; verify target user as needed for a coherent response.

## Database Impact

Use indexed projectId/userId lookup; no new membership collection.

## API Impact

Reject nonmember targets with a documented 400/403 policy; malformed identifiers use 400.

## Frontend Impact

Reuse `useProjectMembers`; send entry.user.id, not entry.id.

## Authorization Impact

Organization membership or global user existence is insufficient, including elevated-role targets.

## Tests Required

Reject same-organization nonmember, other-project-only user, outsider, and elevated nonmember target.

## Documentation Required

Document error semantics and membership prerequisite.

## Risks / Edge Cases

Stale membership options; future removal racing assignment.

## Decision Needed

Choose target-not-eligible status consistently; proposed 400 for an eligible actor's invalid target.

---

## Requirement

4. Unassignment (brief §06–07)

## Existing Location

`tasks/dto/` has no assignee DTO; `TasksService` has no unassignment path.

## Current Behavior

No current behavior.

## Required Change

Accept explicit null; distinguish omission/no-op from clearing. Record old ID -> null only on change.

## Backend Impact

Use the same assignment policy/change function.

## Database Impact

Store null and preserve old value for history.

## API Impact

Nullable input and output; validate non-null IDs.

## Frontend Impact

Provide an accessible Unassigned choice and pending/error state.

## Authorization Impact

Reasoned assumption, not explicit brief wording: OWNER/ADMIN/PROJECT_MANAGER may clear any manageable task; MEMBER may clear only their own assignment. Authorized already-null requests are no-ops as defined in Selected Policies.

## Tests Required

Manager unassignment; allowed self-unassignment; rejected removal of another user's assignment; already-null no-op.

## Documentation Required

State the assumption in ASSESSMENT_NOTES and README.

## Risks / Edge Cases

A member may replace another assignee with themselves under literal self-assignment rule; silently forbidding it adds a requirement.

## Decision Needed

Resolved by the selected unassignment assumption above. Null explicitly clears; omission never clears and is rejected on the dedicated endpoint; no event for already-null/no-op assignment.

---

## Requirement

5. Assignee activity history (brief §07)

## Existing Location

`apps/api/src/tasks/tasks.service.ts` mutation paths; `comments/schemas/comment.schema.ts` is a schema convention reference, not an activity model.

## Current Behavior

No activity model, writes, or shared activity contract exists.

## Required Change

Record TASK_ASSIGNEE_CHANGED with actor, task, metadata.from/to, createdAt for all three actual transitions.

## Backend Impact

Add task-activity model/service integration with task mutation; do not track unrelated changes for this assessment.

## Database Impact

Preferred branch: separate indexed activity collection with transactional task/event persistence after topology verification. Complete the Consistency Gate before implementing assignment; if unsupported, explicitly select and document the safe single-document fallback and its indexing/growth limitations.

## API Impact

Return typed activity entries; use nullable IDs for unassigned transitions.

## Frontend Impact

Timeline must read persisted events, not synthesize history from current state.

## Authorization Impact

Only successful authorized changes produce events; actor derives from JWT context.

## Tests Required

Assign, reassign, unassign; no event on rejected/no-op requests; failed persistence and concurrent changes preserve accurate history.

## Documentation Required

Explain schema, atomicity, concurrency, retries, and retention/deletion semantics.

## Risks / Edge Cases

Task save followed by event insert can leave missing history; concurrent read/save can record incorrect previous assignee.

## Decision Needed

Implementation-time evidence must select the branch at the Consistency Gate. No successful assignee change may lack history. Do not leave this unresolved while implementing independent task and activity writes.

---

## Requirement

6. Activity API (brief §08)

## Existing Location

`apps/api/src/comments/comments.controller.ts::findByTask`, `comments.service.ts::findByTask`; `packages/shared/src/api.ts::Paginated`.

## Current Behavior

Comments provide a task-scoped paginated endpoint; activity does not exist.

## Required Change

Add `GET /tasks/:taskId/activity` with typed paginated records.

## Backend Impact

Use a thin controller and service; register new providers/models without circular service dependencies.

## Database Impact

Query activity by actual task ID.

## API Impact

Reuse `{items,total,page,pageSize}` convention unless a documented decision changes it.

## Frontend Impact

Add activity api.ts/hook and cache keys.

## Authorization Impact

Authenticate globally and check task's actual project before reading events/counts.

## Tests Required

Response shape; empty task history; nonexistent/malformed task; success and errors.

## Documentation Required

Document endpoint, response, order, and examples in README.

## Risks / Edge Cases

Do not expose raw Mongoose documents or credential fields.

## Decision Needed

Recommend retaining offset response convention initially.

---

## Requirement

7. Activity pagination (brief §08)

## Existing Location

`apps/api/src/common/dto/pagination.dto.ts::PaginationQueryDto`; shared DEFAULT_PAGE_SIZE/MAX_PAGE_SIZE.

## Current Behavior

Existing pagination uses page/size with skip; comments sort oldest first.

## Required Change

Reuse validated bounds (default 25, max 100) but order activity newest first with deterministic tie-breaker.

## Backend Impact

Sort by createdAt descending, then _id descending; keep query/count task-scoped.

## Database Impact

Support equality prefix and sort with compound index.

## API Impact

Reject invalid page/size; include paging metadata.

## Frontend Impact

Implement working next/load-more controls rather than copying comments' first-page-only client.

## Authorization Impact

Apply access check to each page request.

## Tests Required

Page boundaries, equal timestamps, invalid limits, no cross-task records, newest-first order.

## Documentation Required

Explain offset choice and concurrent-insert limitations.

## Risks / Edge Cases

New events between offset pages can shift entries; huge offsets degrade scalability.

## Decision Needed

Offset is smallest consistent default; cursor migration belongs in scaling discussion.

---

## Requirement

8. Activity authorization (brief §08, §13)

## Existing Location

`TasksService.findTaskOrFail` and `ProjectAccessService.assertCanView`; comments read path.

## Current Behavior

Task existence helper alone does not authorize; comments explicitly call access service.

## Required Change

Follow protected comment-read sequence using task.projectId.

## Backend Impact

Require user context at the activity service boundary.

## Database Impact

No role fields duplicated in activity records for access decisions.

## API Impact

401 unauthenticated; 403 forbidden; 404 missing task per existing convention.

## Frontend Impact

Handle denied/expired sessions without showing stale history as fresh data.

## Authorization Impact

OWNER/ADMIN retain intended organization-wide view; ordinary users need project membership.

## Tests Required

Unauthenticated, same-org nonmember, other-project member, cross-org actor; allowed member and elevated role.

## Documentation Required

Document access policy and regression evidence.

## Risks / Edge Cases

Client route projectId and supplied actor/project parameters cannot establish authorization.

## Decision Needed

Recommend existing task-view policy for history reads.

---

## Requirement

9. Activity query performance / N+1 (brief §08)

## Existing Location

`apps/api/src/comments/comments.service.ts::toEntries`; `users/users.service.ts::findManyByIds`; `tasks/tasks.service.ts::toSummaries`.

## Current Behavior

Comments and tasks already batch related-user lookups.

## Required Change

Batch distinct actor and from/to user IDs for each page; build lookup maps.

## Backend Impact

Reuse UsersService batch method; avoid per-row user queries.

## Database Impact

Bound user enrichment by page size and use one set lookup where practical.

## API Impact

Return safe summaries and preserve event IDs/metadata.

## Frontend Impact

Render readable names with missing-user fallbacks.

## Authorization Impact

Never leak passwordHash; use explicit summary serialization.

## Tests Required

Strongly recommended: missing-user fallback. Inspect batch lookup structure for N+1 prevention; exact query-count assertions are nice-to-have automation, not a prerequisite to the core security tests.

## Documentation Required

Explain query pattern in ASSESSMENT_NOTES/scaling discussion.

## Risks / Edge Cases

Comments currently drop rows when authors are missing; copying that behavior would erase visible history and disagree with total.

## Decision Needed

Selected: live batched summaries with Unknown user fallback; retain original reference IDs and activity rows. Historical name snapshots are deferred.

---

## Requirement

10. Activity indexes (brief §08)

## Existing Location

Existing `comments/schemas/comment.schema.ts::CommentSchema` indexes taskId/createdAt; no activity schema.

## Current Behavior

No activity index exists.

## Required Change

Declare index matching task equality and descending timestamp/ID order.

## Backend Impact

Keep schema registration and index rollout documented.

## Database Impact

Proposed `(taskId:1,createdAt:-1,_id:-1)`; avoid unrelated indexes.

## API Impact

No extra API surface.

## Frontend Impact

None directly.

## Authorization Impact

Indexing is not an authorization control.

## Tests Required

Verify the chosen branch's index exists in the isolated DB and matches its query shape. Detailed explain/benchmark work is deferred unless correctness or observed performance requires it.

## Documentation Required

Document index creation and deployment verification.

## Risks / Edge Cases

Schema declarations alone do not prove production indexes exist; extra indexes increase write/storage cost.

## Decision Needed

Decide deployment mechanism with chosen schema; do not claim index installed merely from code.

---

## Requirement

11. Frontend assignee selector (brief §09)

## Existing Location

`apps/web/src/features/tasks/components/task-view.tsx::TaskView`; `features/projects/hooks.ts::useProjectMembers/useProject`; `features/auth/hooks.ts::useCurrentUser`; `components/ui/select.tsx`.

## Current Behavior

Task details have status, priority, creator, comments; project members endpoint/hook already exists.

## Required Change

Add selector in existing task metadata area; show members, Unassigned, and search when appropriate.

## Backend Impact

Reuse existing member endpoint; add only assignment route/response changes.

## Database Impact

No extra frontend-driven schema.

## API Impact

Use typed assignment payload and safe returned summaries.

## Frontend Impact

Loading, disabled/pending, empty, no search matches, error/retry, responsive layout, keyboard focus, accessible label, long names; preserve creator display.

## Authorization Impact

Derive UI choices from scoped roles; backend remains authoritative. Fetch project.organizationId or expose capabilities deliberately.

## Tests Required

Verify member versus elevated options, search, clear, network error, narrow screen, keyboard interaction.

## Documentation Required

Explain selector/search and permission-state decisions.

## Risks / Edge Cases

Existing Select has no search input; use supported accessible composition rather than assuming it is a combobox.

## Decision Needed

Selected direction: reuse useProjectMembers(task.projectId), existing Input/Label and Select primitives, with a separately labeled client-side name/email filter and no-match state when the member list warrants search. Do not insert an arbitrary input inside Radix Select or introduce a large search dependency. Verify keyboard/focus behavior and narrow layout; only change the composition if interaction evidence requires it. Backend remains authoritative.

---

## Requirement

12. Frontend update strategy (brief §09)

## Existing Location

`apps/web/src/features/tasks/hooks.ts::useUpdateTaskStatus`; `lib/query-keys.ts`; `providers/query-provider.tsx`.

## Current Behavior

Status waits for server response, sets task cache, then invalidates project tasks.

## Required Change

Use the same server-confirmed mutation strategy for assignment; keep pending state and refresh activity pages after success.

## Backend Impact

Return canonical TaskDetail after persisted change.

## Database Impact

None beyond assignment/history writes.

## API Impact

A rejected or aborted persistence operation leaves task and history unchanged. A lost response after commit is ambiguous: refetch canonical state before retrying, rather than claiming rollback.

## Frontend Impact

Set detail cache, invalidate project tasks and relevant activity prefix; recover cleanly after failure.

## Authorization Impact

Disable unsupported actions and prevent pending interactions from producing accidental repeat requests.

## Tests Required

Success refreshes assignee/history; failure retains old value; switching task does not update wrong cache.

## Documentation Required

Explain why server-confirmed updates satisfy the permitted alternative to optimistic rollback.

## Risks / Edge Cases

Existing broad query prefixes can refetch descendants; ensure pagination is encoded in keys.

## Decision Needed

Selected: server-confirmed updates, matching the existing hook pattern and the brief's allowed alternative. Preserve previous confirmed UI on error, refresh canonical state when outcome is uncertain, and show a clear error. No optimistic layer without demonstrated need.

---

## Requirement

13. Activity timeline (brief §10)

## Existing Location

`TaskView`; `features/comments/components/comment-list.tsx::CommentList`; `lib/format.ts`.

## Current Behavior

Comments render avatar, text, absolute date, skeleton/empty/error states; no activity.

## Required Change

Add plain-language assignee history using actor/from/to and timestamps, newest first.

## Backend Impact

Supply batched summaries and stable event IDs.

## Database Impact

Read stored activity only.

## API Impact

Consume paginated activity endpoint.

## Frontend Impact

Integrate existing typography, borders, semantic colors, and responsive layout; support page loading, empty/error states, and accessible time text.

## Authorization Impact

Do not imply user can read history if request is denied.

## Tests Required

All three transition wordings; actor equals old/new assignee; missing/deleted names; pagination and error recovery.

## Documentation Required

Describe significant rendering decisions.

## Risks / Edge Cases

Do not output raw IDs/JSON as normal history; no-op events should not exist.

## Decision Needed

Choose relative display with absolute accessible timestamp or existing date-time helper; no redesign.

---

## Requirement

14. Production authorization bug (brief §11)

## Existing Location

`apps/api/src/tasks/tasks.controller.ts::updateStatus`; `tasks.service.ts::updateStatus`; `common/guards/jwt-auth.guard.ts`; `test/tasks.e2e.spec.ts`.

## Current Behavior

Confirmed source omission: status route passes no current user and service performs no project check. No successful outsider request was reproduced here.

## Required Change

In a disposable test DB, create a project/task and authenticated nonmember; PATCH status and verify persisted state. Compare GET/general PATCH/DELETE. Only then document reproduced behavior and fix the boundary.

## Backend Impact

Pass authenticated user into status service and apply policy against stored task.projectId.

## Database Impact

No schema change for access fix.

## API Impact

Preserve endpoint; reject unauthorized users before writing.

## Frontend Impact

Retain the status selector for authorized task viewers, matching the selected project-access policy.

## Authorization Impact

Preserve intended OWNER/ADMIN access; investigate ordinary outsider, same-org nonmember, and other-project member separately.

## Tests Required

Regression cases for all task mutation routes, verifying denied requests leave DB unchanged; positive cases for intended roles.

## Documentation Required

Future BUG_REPORT must state root cause, reproduction, impact, fix, prevention, or nonexistence evidence, with actual results.

## Risks / Edge Cases

Missing check is confirmed; production incident and successful runtime exploitation remain unverified. Never relabel static inspection as reproduction.

## Decision Needed

Resolved: status uses assertCanView on the stored task.projectId. This denies users without project access while preserving OWNER/ADMIN and explicit members. General PATCH keeps creator/manager rules; DELETE keeps management rules. This choice is justified in Selected Policies, not attributed to explicit brief wording.

---

## Requirement

15. Concurrent task creation (brief §12)

## Existing Location

`TasksService.create`, `TaskSchema`, `ProjectSchema`, `database/seed.ts`, `test/utils/fixtures.ts`.

## Current Behavior

Separate count+1 and insert; nonunique project/number index; seed and fixtures insert explicit numbers.

## Required Change

Replace count with a database-coordinated per-project allocator and enforce unique `(projectId,number)`; do not rely on process-local locks.

## Backend Impact

Selected direction: atomically increment a high-water counter on the existing Project document and use the returned value for number/key. Authorize first; no process-local locks or new counter service architecture.

## Database Impact

Initialize new projects and counter-aware seed/fixtures as necessary. For a fresh disposable dataset, do not build a migration framework. Only if retained existing tasks require initialization, inspect those data and initialize from their maximum number before enabling allocation; use a short controlled write pause or equivalently safe initialization. Only if actual duplicates exist, document their extent and resolve them before unique-index creation; do not silently renumber retained data. Verify the required unique (projectId,number) index, replacing the old nonunique index only as needed. These are conditional compatibility steps, not an automatic production migration project.

## API Impact

Preserve current numeric/key response shape; handle allocation/storage failures intentionally.

## Frontend Impact

No behavior redesign; task creation continues through existing hook.

## Authorization Impact

Authorize before allocating a number.

## Tests Required

Parallel HTTP creates all succeed with unique project-specific numbers/keys; multiple projects; post-deletion creation; existing data above count; index enforcement.

## Documentation Required

Explain atomic allocation, project-scoped uniqueness, seed/fixture initialization, and allowed gaps. Document a small backfill/remediation procedure only when actual retained data requires one.

## Risks / Edge Cases

Counter increment and task insert are separate writes; failed inserts can leave gaps. Highest historical deleted number cannot be reconstructed from surviving tasks.

## Decision Needed

Resolved: unique monotonic allocation with gaps allowed; failed task inserts may consume a number, and deletion never decrements the counter. Gapless numbering is not required. Only actual retained data determines whether bounded initialization/duplicate remediation is necessary; no migration framework by default.

---

## Requirement

16. Required automated tests (brief §13)

## Existing Location

`apps/api/test/*.e2e.spec.ts`, `test/utils/fixtures.ts`, `test/utils/test-app.ts`, `test/global-setup.ts`.

## Current Behavior

20 existing integration cases; six task cases omit mutation/assignment/activity/concurrency. No web harness.

## Required Change

Extend existing integration structure with meaningful policy and persistence assertions.

## Backend Impact

Exercise actual controllers/services/DTOs and isolated Mongo, not only mocks.

## Database Impact

If transactions chosen, replace standalone fixture with replica-set test setup; await relevant indexes.

## API Impact

Cover auth/error contracts and paginated results.

## Frontend Impact

Run focused UI verification; add automated UI coverage only with justified minimal tooling.

## Authorization Impact

Cover self assignment, all authorized roles assigning others, member denial, outside-project target denial, and cross-project mutation denial.

## Tests Required

Use Test Priority Tiers above: finish all must-have policy, transition, authorization, atomicity, and parallel-creation checks first. Then strongly recommended no-op/paging/order/fallback/creator checks. Defer detailed UI automation and exact query-count assertions before sacrificing backend coverage.

## Documentation Required

Record commands, results, limitations, and rationale, not invented coverage percentages.

## Risks / Edge Cases

Raw fixture inserts bypass service defaults; counter/index setup must be deliberate.

## Decision Needed

Choose failure/concurrency cases based on chosen persistence design. No assessment tests are added during this phase.

---

## Requirement

17. Code review exercise (brief §14)

## Existing Location

Authoritative brief §14 supplies assignTask; future root `ASSESSMENT_NOTES.md` does not exist.

## Current Behavior

Provided snippet finds task/user, sets assignee, saves; userId is unused. It is an exercise, not repository code.

## Required Change

Later write `## Code Review` in ASSESSMENT_NOTES with prioritized PR-style findings and requested changes, not a replacement implementation.

## Backend Impact

Relate review to TasksService, ProjectAccessService, membership checks, and serialization.

## Database Impact

Discuss missing activity consistency, concurrent changes, and reference integrity.

## API Impact

Discuss null/unassignment, validation, safe output, and error behavior.

## Frontend Impact

Mention client implications only where relevant.

## Authorization Impact

Call out unused actor and absent actual-project/target eligibility checks.

## Tests Required

Recommend regression/policy/consistency tests with reasons.

## Documentation Required

Cover correctness, security, authorization, business rules, consistency, maintainability, errors, performance, architecture.

## Risks / Edge Cases

Do not confuse hypothetical snippet findings with reproduced repository bugs.

## Decision Needed

No new architecture required for the exercise.

---

## Requirement

18. Scaling discussion (brief §15)

## Existing Location

Future activity design; existing offset pagination and batched user enrichment in CommentsService.

## Current Behavior

No activity dataset or measured performance baseline exists.

## Required Change

Later provide one to two pages on growth from roughly 5,000 to 500,000 users.

## Backend Impact

Discuss query patterns, background jobs/queues, asynchronous processing, real-time updates, and thresholds for introducing them.

## Database Impact

Discuss indexes, data growth, retention, archiving, cursor versus offset paging.

## API Impact

Explain compatibility during paging evolution.

## Frontend Impact

Discuss cache invalidation/live history only as justified by demand.

## Authorization Impact

Preserve access checks across cache/stream paths.

## Tests Required

Recommend observable latency/query/load checks; do not claim benchmark results.

## Documentation Required

Include caching and observability; explain what, when, and why; keep within page limit.

## Risks / Edge Cases

User count alone is not write/read volume; establish workload assumptions.

## Decision Needed

Propose a Scaling section in ASSESSMENT_NOTES; avoid adding infrastructure during implementation solely for this essay.

---

## Requirement

19. README and developer experience (brief §19–20)

## Existing Location

Root `README.md`, `.env.example`, package scripts, `apps/web/package.json`, `apps/api/src/database/seed.ts`.

## Current Behavior

README already covers install, env, Mongo, seed, ports, run, tests, and architecture.

## Required Change

Extend existing README with actual decisions, limitations, new API/schema setup; verify clean-machine instructions.

## Backend Impact

Document API startup and any topology requirement introduced.

## Database Impact

Document initialization, migrations/indexes/counters, and destructive seed behavior.

## API Impact

Describe new endpoint contracts where useful.

## Frontend Impact

Document web startup; existing `${WEB_PORT:-3742}` script syntax needs platform verification.

## Authorization Impact

No credentials in committed examples.

## Tests Required

Later verify install/run/build/test workflow in intended environment.

## Documentation Required

Setup, environment, database, running both apps, tests, technical decisions, limitations; .env.example when needed.

## Risks / Edge Cases

Docker is welcome, not mandatory; do not add it without a concrete need. Windows shell compatibility is unverified.

## Decision Needed

Decide supported shell and database topology based on actual verification.

---

## Requirement

20. ASSESSMENT_NOTES.md and Final Reflection (brief §04, §14–15, §23)

## Existing Location

Future root `ASSESSMENT_NOTES.md`; evidence in CODEBASE_MAP and RISK_REGISTER.

## Current Behavior

File absent; this phase creates reconnaissance documents only.

## Required Change

Later synthesize architecture, business logic, frontend communication/state, auth, entity relationships, and at least three risks with now/later reasons.

## Backend Impact

Explain actual engineering choices after implementation.

## Database Impact

Explain selected consistency/numbering approach.

## API Impact

Explain material API choices.

## Frontend Impact

Explain update strategy and permission UX.

## Authorization Impact

Explain actual preserved/changed policy.

## Tests Required

Summarize executed tests and their purpose.

## Documentation Required

Include `## Code Review`; scaling discussion; end with exact `## If I Had Two More Days`, prioritized and justified.

## Risks / Edge Cases

Do not copy the entire assessment or represent planned work as completed.

## Decision Needed

Choose two-day priorities from remaining observed risks after implementation.

---

## Requirement

21. BUG_REPORT.md (brief §11)

## Existing Location

Future root `BUG_REPORT.md`; status-route source and proposed reproduction in item 14.

## Current Behavior

File absent; source omission found, runtime reproduction not attempted.

## Required Change

Later create evidence-based report after isolated reproduction or a documented non-reproduction conclusion.

## Backend Impact

Identify exact controller/service boundary and eventual change.

## Database Impact

Record before/after persisted status without exposing real user data.

## API Impact

Include reproducible request roles/routes/status codes.

## Frontend Impact

Explain affected status interaction where relevant.

## Authorization Impact

Differentiate intended elevated access from unauthorized ordinary nonmembers.

## Tests Required

Link regression tests and actual outcomes.

## Documentation Required

Root Cause, Reproduction, Impact, Fix, Regression Prevention; or evidence that issue does not exist.

## Risks / Edge Cases

Do not call a 200 response sufficient without confirming unauthorized actor setup and database change.

## Decision Needed

Keep incident status truthful until reproduction is complete.

---

## Requirement

22. AI_LOG.md (brief §16–17)

## Existing Location

Future root `AI_LOG.md`; current assistance was repository exploration and planning.

## Current Behavior

File absent; no generated application code this phase.

## Required Change

Later maintain four short sections: Tools used; How you used them; Suggestions you rejected; Generated code you modified.

## Backend Impact

Describe actual AI-assisted implementation/review if it occurs.

## Database Impact

Explain accepted/rejected database advice truthfully.

## API Impact

No API change.

## Frontend Impact

No frontend change for this documentation requirement.

## Authorization Impact

Candidate must understand and explain every accepted decision.

## Tests Required

Record actual assistance in tests/debugging, not claimed verification.

## Documentation Required

Name tools briefly; explain at least one genuine rejection/significant change and why; summarize modified generated code when applicable.

## Risks / Edge Cases

Do not fabricate a rejection or code modification to fill a template; no full conversation dump required.

## Decision Needed

For this phase state no application code generated; update evidence during implementation.

---

## Requirement

23. Git history (brief §18)

## Existing Location

Branch main; HEAD `27c84d89830b1e3bce6ea75c413bdfe90cc3473f`; recent conventional messages recorded in CODEBASE_MAP §16.

## Current Behavior

Existing history already has focused feat/fix/test/docs/chore/style commits. Brief starts untracked.

## Required Change

No commits now. Later preserve logical implementation evolution and exact applicable messages listed below.

## Backend Impact

Separate domain, history, and fixes into coherent changes when practical.

## Database Impact

Include schema/setup changes with the work that depends on them.

## API Impact

Keep contracts and implementation coherent per commit.

## Frontend Impact

Include relevant UI changes in meaningful feature commits.

## Authorization Impact

Use required membership-fix and regression-test wording for corresponding work.

## Tests Required

Include meaningful tests; avoid a single final commit without explanation.

## Documentation Required

Keep assessment file unchanged; future deliverable additions should reflect actual work.

## Risks / Edge Cases

Untracked authoritative brief predates this phase; never overwrite it or accidentally commit .env.

## Decision Needed

Decide later commit boundaries without rewriting required message wording.

---

## Requirement

24. Final verification and submission (brief §21–26)

## Existing Location

Root scripts/README; authoritative brief evaluation and submission checklist.

## Current Behavior

No implementation, runtime baseline, or final deliverables completed in reconnaissance.

## Required Change

Later verify startup, feature behavior, tests, schema inclusion, documentation completeness, and no committed secrets; review final diff.

## Backend Impact

Run appropriate build/lint/typecheck/test checks, then startup verification.

## Database Impact

Verify index/counter rollout and any topology requirement on intended setup.

## API Impact

Verify permissions, activity paging, assignment transitions, and concurrent creation.

## Frontend Impact

Verify loading/disabled/error/empty/search/mobile/keyboard behavior.

## Authorization Impact

Confirm access decisions and mutation regressions with actual results.

## Tests Required

Record exact commands/outcomes and outstanding failures; never equate static checks with runtime success.

## Documentation Required

Include source, README, ASSESSMENT_NOTES, BUG_REPORT, AI_LOG, automated tests, schema changes, applicable env example.

## Risks / Edge Cases

Brief expects 4 hours, hard cap 6 hours and deliberate prioritization; deployment optional. This reconnaissance does not assert implementation time spent.

## Decision Needed

Submission later: applicant email, applied role, own starter-based GitHub URL, optional demo, up to 5 ZIP/PDF/PNG/JPG files ≤10MB each, approximate time in Additional Notes at the brief's careers portal; no automatic submission.

---

## Recommended Implementation Order

1. Establish a clean baseline and reproduce the suspected authorization bug with persisted-state evidence in an isolated/disposable database. “Clean baseline” means understand and record existing changes, not discard them.
2. Fix the verified authorization boundary and add focused regression coverage using the selected project-access policy.
3. Make project-specific task numbering concurrency-safe and verify uniqueness under parallel creation; perform retained-data repair only if actual data requires it.
4. Implement assignment policy, target membership validation, and unassignment after resolving the Consistency Gate.
5. Implement assignment activity persistence using the chosen consistency strategy. Steps 4–5 are one correctness milestone; do not expose a successful assignment endpoint without activity.
6. Add the authorized, indexed, paginated activity API with batched user enrichment.
7. Add the frontend assignee selector and activity timeline using existing UI patterns and server-confirmed updates.
8. Complete required tests, documentation, code review, scaling discussion, AI log, and final reflection. Tests and evidence capture begin alongside each earlier change; they are not postponed wholesale to this step.
9. Run final verification and review the complete diff before submission, within the hard cap.

## Exact Commit Messages for Later Applicable Work

```text
feat: add task assignment domain logic
feat: implement task activity history
fix: enforce project membership on task mutations
fix: make project task numbering concurrency-safe
test: add task authorization regression coverage
```

The assessment's extracted text visually contains extra spacing after `fix:`; the user's explicit phase instructions supply the exact strings above, which must be retained when that work is performed. No commits are made now.

## Decision Summary

Resolved planning choices: scoped self/manager assignment, member-only-own unassignment assumption, project-access status policy, User-reference assignee, explicit-null/omission distinction, allowed numbering gaps, offset paging, retained missing-user history, minimal member search, and server-confirmed updates. Preserve the exact applicable commit messages above.

Intentionally open pending implementation evidence: actual Mongo topology and transaction setup practicality (resolve before assignment coding); presence of retained tasks/duplicates and the minimal required initialization; any demonstrated keyboard/accessibility issue requiring adjustment to the proposed primitive composition; actual baseline failures and available remaining time. Do not leave policy ambiguities open as a substitute for the decisions already made. No database topology or duplicate presence has been verified in this planning revision.

Minor ambiguities permit reasoned documented assumptions under brief §22; they do not justify unrelated architecture changes. Existing seed task descriptions do not add requirements. Evaluation spans understanding, interpretation, backend/frontend/database/security/consistency/concurrency/API/TypeScript/testing/debugging/organization/Git/docs and restraint (§21–22).

## Stop Condition

Only `Technical Assessment/IMPLEMENTATION_PLAN.md` is modified in this revision. The authoritative brief, CODEBASE_MAP.md, RISK_REGISTER.md, application source, dependencies, and Git history remain unchanged. No final deliverables are created. Stop after validating this plan; no automatic implementation or submission follows.
