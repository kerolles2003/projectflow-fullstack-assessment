# ProjectFlow — Production Bug Report

## Reported Issue

Support reported that some users could modify tasks in projects they did not belong to. The confirmed defect was specifically the **task-status authorization bypass** in `PATCH /tasks/:taskId/status`, not a general bypass across all task routes.

## Impact

An authenticated, non-elevated user with a target task ID could change its status without access to its project. This could misrepresent progress and disrupt project workflows. The tested GET, general PATCH and DELETE routes already rejected that same outsider. Organization OWNER/ADMIN access without explicit project membership is intentional existing policy and was not treated as unauthorized.

## Reproduction

The pre-fix investigation used disposable MongoDB, real Nest AppModule/JWT authentication and existing fixture helpers. It did not access production data.

1. Create Project A with a task initially in TODO and an authorized creator/member.
2. Authenticate a regular organization MEMBER who belongs only to Project B; verify no membership in Project A.
3. Send `PATCH /tasks/<Project-A-task-id>/status` with `{"status":"IN_PROGRESS"}`.
4. Read the raw task before and after the request and compare other task endpoints using the same actor.

| Pre-fix request     | Observed HTTP result | Persisted result        |
| ------------------- | -------------------- | ----------------------- |
| GET target task     | 403                  | Unchanged               |
| PATCH target status | **200**              | **TODO → IN_PROGRESS**  |
| General PATCH title | 403                  | Unchanged               |
| DELETE target task  | 403                  | Task remained unchanged |

The recorded status mutation kept the task's Project A scope. The task's status changed from TODO to IN_PROGRESS and the mutation persisted. Apart from status and the modification timestamp, other stored fields remained unchanged. The successful response contained IN_PROGRESS and task key E1A-1. An authorized target-project member could also update status successfully.

Source evidence: `Technical Assessment/JIRA_E1_T1_DOCKER_REPRODUCTION.md`, “Prior separately authorized runtime evidence.” Earlier attempts were blocked before database startup; the later successful reproduction is distinct. The original six-test suite did not test this status boundary, so its passing result alone did not establish the defect or its absence.

## Root Cause

At baseline `0cb2403`, `TasksController.updateStatus` did not extract/forward authenticated user identity. `TasksService.updateStatus` called `findTaskOrFail`, assigned the requested status and saved. Finding a task by ID is not authorization. The global JWT guard verified the caller, but no ProjectAccessService check occurred before persistence. A later project lookup for response serialization did not enforce access either.

## Fix

Commit `c765dcc` (`fix: enforce project membership on task mutations`) forwards `CurrentUser('id')` through the existing ObjectId conversion pattern. The service calls `assertCanView(task.projectId, userId)` before changing status or saving. This preserves existing project-member and organization OWNER/ADMIN access and does not broaden the stricter general-edit/delete rules.

## Regression Prevention

The regression test specifically verifies that the unauthorized status PATCH returns 403 and that the task document remains unchanged. The same test coverage also confirms that GET, general PATCH, and DELETE remain protected for the same outsider. Parameterized positive member/OWNER/ADMIN cases check successful persisted status, canonical project identity and unchanged creator, preventing an indiscriminate deny-all fix.

## Verification

The initial post-fix task suite passed 10 tests in disposable MongoDB. The latest fresh root verification ran `pnpm test --force`: **4 suites, 50 tests passed, zero failed/skipped, 101.848 seconds** of Jest time, using the existing disposable MongoMemoryReplSet setup. The tested E6 assertions are now committed in `8a08ab8`, the current implementation HEAD.

The reproduction and fix are locally verified. No production incident dataset, deployed topology or production rollout was inspected. The report was based on the latest recorded verification results; no additional test run was performed specifically while writing this report.
