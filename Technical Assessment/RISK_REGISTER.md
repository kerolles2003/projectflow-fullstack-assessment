# Risk Register

Reconnaissance date: 2026-09-15. Paths are repository-relative. Findings describe inspected source. No live database, application, browser, or tests were run, so no production incident, runtime exploit, data loss, or performance measurement is claimed. “Next implementation phase” means after the user's explicit reconnaissance stop; nothing is fixed now.

## R1. Status mutation has no project authorization

- **Risk:** An authenticated nonmember may modify a known task through the status endpoint.
- **Evidence:** `TasksController.updateStatus` supplies only taskId/DTO; `TasksService.updateStatus` calls findTaskOrFail, saves status, and returns detail without calling project access. Global JwtAuthGuard verifies identity only. General update/remove have explicit access checks.
- **Relevant file(s):** `apps/api/src/tasks/tasks.controller.ts`, `apps/api/src/tasks/tasks.service.ts`, `apps/api/src/common/guards/jwt-auth.guard.ts`.
- **Potential impact:** Cross-project status changes and disclosure of returned task detail to a caller holding a valid token and task ID.
- **Whether relevant to assessment:** Directly relevant to Production Bug Investigation and unauthorized mutation tests (§11, §13).
- **Fix now or later:** First priority in the next implementation phase, after isolated reproduction.
- **Reason:** This is a concrete missing security boundary. Preserve intended organization OWNER/ADMIN access while fixing ordinary nonmember access.
- **Evidence classification:** Missing source check confirmed; production report suspected; successful HTTP exploit and persisted change not reproduced. Proposed reproduction is in IMPLEMENTATION_PLAN requirement 14.

## R2. Task numbers can collide or be reused

- **Risk:** Concurrent creation or deletion followed by creation can produce duplicate project-specific identifiers.
- **Evidence:** `TasksService.create` reads countDocuments and separately inserts count+1. `TaskSchema.index({projectId:1,number:1})` is nonunique. Two readers can select the same next number. With surviving numbers 1 and 3, count+1 also selects 3.
- **Relevant file(s):** `apps/api/src/tasks/tasks.service.ts::create`, `apps/api/src/tasks/schemas/task.schema.ts::TaskSchema`, `apps/api/src/database/seed.ts`, `apps/api/test/utils/fixtures.ts`.
- **Potential impact:** Ambiguous human identifiers and unreliable sequencing; future unique-index rollout may fail if duplicate data already exists.
- **Whether relevant to assessment:** Directly required by Concurrent Task Creation (§12–13).
- **Fix now or later:** High priority in the next implementation phase.
- **Reason:** Correct allocation needs database coordination, project-scoped uniqueness, and deliberate initialization for seed/fixtures/existing data. Do not substitute a process-local lock or count retry alone.
- **Evidence classification:** Unsafe algorithm confirmed by source reasoning; actual duplicate database records and concurrent workload not inspected/reproduced. Existing project keys are unique per organization, so global task-key uniqueness would be an incorrect assumption.

## R3. Tests leave mutation authorization and concurrency unprotected

- **Risk:** A green existing suite would not establish that task mutation boundaries or concurrent numbering are correct.
- **Evidence:** Six cases in tasks.e2e.spec cover create, sequential numbering, outsider create/list denial, title validation, and filtering; none issues PATCH or DELETE. Tests do not exercise simultaneous task creation.
- **Relevant file(s):** `apps/api/test/tasks.e2e.spec.ts`, `apps/api/test/utils/fixtures.ts`, `apps/api/jest.config.js`.
- **Potential impact:** Security and consistency regressions survive existing checks.
- **Whether relevant to assessment:** Directly relevant to required automated tests (§13).
- **Fix now or later:** Add meaningful coverage alongside each fix/feature in the next implementation phase.
- **Reason:** Verify denied requests leave persisted state unchanged and concurrent successful requests have unique identifiers. Avoid merely testing mocked implementation calls.
- **Evidence classification:** Coverage gaps confirmed by source inspection; suite was not executed, so no current pass/fail claim.

## R4. Client task and comment lists stop after one page

- **Risk:** Users may see incomplete project tasks or task discussions without a way to load the rest.
- **Evidence:** fetchProjectTasks always requests page 1 / 100 and TaskBoard renders items only. fetchTaskComments requests page 1 / 50; comments are oldest-first and CommentList offers no paging control.
- **Relevant file(s):** `apps/web/src/features/tasks/api.ts::fetchProjectTasks`, `apps/web/src/features/projects/components/project-view.tsx::ProjectView`, `apps/web/src/features/tasks/components/task-board.tsx::TaskBoard`, `apps/web/src/features/comments/api.ts::fetchTaskComments`, `apps/web/src/features/comments/components/comment-list.tsx::CommentList`, `apps/api/src/comments/comments.service.ts::findByTask`.
- **Potential impact:** Tasks above the first 100 are omitted; new comments beyond the first 50 may not become visible even after invalidation. Copying this client pattern would undermine the new activity API's pagination.
- **Whether relevant to assessment:** Activity pagination/timeline directly; repairing all existing lists is adjacent scope.
- **Fix now or later:** Make the new activity UI genuinely paginated during implementation; document existing list limits for later work.
- **Reason:** Satisfy requested history behavior without expanding into unrelated list redesign.
- **Evidence classification:** Fixed request sizes and absent controls confirmed; no large-data UI reproduction performed.

## R5. Dependent writes are not atomic

- **Risk:** Partial failures can leave related records inconsistent; naively copying current write patterns for activity would permit a changed assignee without a matching event.
- **Evidence:** ProjectsService.create inserts project then membership separately. TasksService.remove deletes comments and task using Promise.all without a session. No transaction/session use was found in API source; tests use standalone MongoMemoryServer.
- **Relevant file(s):** `apps/api/src/projects/projects.service.ts::create`, `apps/api/src/tasks/tasks.service.ts::remove`, `apps/api/src/app.module.ts`, `apps/api/test/global-setup.ts`.
- **Potential impact:** Project created without its explicit creator membership, incomplete deletion, or (in a future naive implementation) missing/misleading audit history. Elevated creators can still access the project, so missing membership is not necessarily total lockout.
- **Whether relevant to assessment:** Activity consistency directly; existing project creation/deletion hardening is broader scope.
- **Fix now or later:** Decide task/activity atomicity before implementing it; defer unrelated multi-write refactors unless needed by chosen design.
- **Reason:** Avoid silently introducing a replica-set requirement into the current documented standalone setup. If transactions are chosen, setup and test topology must change together.
- **Evidence classification:** Separate-write structure confirmed; partial failure/data loss unobserved; future activity inconsistency is a design risk, not an existing activity bug.

## R6. Database conflicts can escape as generic 500 errors

- **Risk:** Concurrent duplicate registration/project/member creation may surface unexpected 500 errors despite friendly prechecks.
- **Evidence:** AuthService.register, ProjectsService.create, and addMember check for duplicates before insertion; schemas declare unique indexes. AllExceptionsFilter handles HttpException specially but has no Mongo duplicate-key translation.
- **Relevant file(s):** `apps/api/src/auth/auth.service.ts::register`, `apps/api/src/projects/projects.service.ts::create/addMember`, `apps/api/src/common/filters/http-exception.filter.ts::AllExceptionsFilter`, corresponding User/Project/ProjectMember schemas.
- **Potential impact:** Misleading API errors and poor retry behavior on concurrent conflicts; important if a future task uniqueness violation is treated as a successful concurrency solution.
- **Whether relevant to assessment:** Relevant to API quality and numbering rollout; blanket conflict handling is adjacent.
- **Fix now or later:** Handle conflicts explicitly in new/changed persistence paths; document broader cleanup for later.
- **Reason:** A unique index alone does not fulfill successful concurrent allocation; distinguish invariant protection from expected API behavior.
- **Evidence classification:** Precheck/write race and filter behavior established from code; deployed indexes and duplicate-request responses not tested.

## R7. URL project context can differ from loaded task context

- **Risk:** Navigation and cache invalidation may use a different project than the task actually belongs to.
- **Evidence:** TaskPage passes both route IDs to TaskView. useTask fetches by taskId alone; TaskView uses route projectId for back link and TaskStatusSelect invalidation, without comparing task.projectId.
- **Relevant file(s):** `apps/web/src/app/(app)/projects/[projectId]/tasks/[taskId]/page.tsx::TaskPage`, `apps/web/src/features/tasks/components/task-view.tsx::TaskView`, `apps/web/src/features/tasks/hooks.ts::useUpdateTaskStatus`.
- **Potential impact:** Incorrect back navigation or stale actual-project list; future assignee choices could be derived from the wrong project if route context is trusted.
- **Whether relevant to assessment:** Directly relevant when adding the selector and refresh behavior.
- **Fix now or later:** Use canonical task.projectId for new assignment/member logic; consider rejecting/canonicalizing mismatched routes during implementation.
- **Reason:** Backend must always validate stored task scope. This UI mismatch does not independently establish a backend authorization bypass.
- **Evidence classification:** Unchecked context use confirmed; UI mismatch not exercised in a browser.

## R8. Existing deleted-user handling is unsuitable for a durable timeline

- **Risk:** Copying comment serialization could silently omit activity when a referenced user is absent.
- **Evidence:** CommentsService.toEntries flatMaps missing authors to no rows, while total counts all comments. TasksService.toSummaries instead uses an Unknown user creator fallback.
- **Relevant file(s):** `apps/api/src/comments/comments.service.ts::toEntries/findByTask`, `apps/api/src/tasks/tasks.service.ts::toSummaries/toCreatorSummary`.
- **Potential impact:** Invisible historical changes or inconsistent paging totals if the comment pattern is reused for activity.
- **Whether relevant to assessment:** Relevant to activity integrity, timeline clarity, and N+1 design.
- **Fix now or later:** Preserve future activity rows with a documented missing-user representation; defer existing comment cleanup.
- **Reason:** The new history should not disappear because enrichment data is missing; no user deletion endpoint was found, but missing references can exist through direct database changes.
- **Evidence classification:** Serializer behavior confirmed; missing-user records and data deletion unobserved.

## Prioritization and Open Decisions

Address R1–R3 first, and design against R5 before adding history. Avoid carrying R4/R7/R8 into the new feature. Existing broader cleanup belongs in the later assessment notes and prioritized `## If I Had Two More Days` reflection. Unassignment permissions, status-role policy, Mongo topology/atomicity, counter rollout/gaps, and missing-user representation are decisions, not additional invented requirements.

NO APPLICATION SOURCE CODE WAS MODIFIED DURING THIS PHASE.
