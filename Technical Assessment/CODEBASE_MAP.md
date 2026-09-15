# Codebase Map

Reconnaissance date: 2026-09-15. Authoritative specification: `Technical Assessment/ET-Fullstack-Assessment-ProjectFlow.md`, sections 01–26. Repository paths below are relative to the root. This document describes inspected source, not verified production state. No application, seed, database, test suite, or browser session was run in this phase. No dependency was installed. Declared indexes are distinguished from indexes actually deployed in MongoDB, which were not inspected.

## 1. Repository Structure

- `apps/api`: Nest application, domain modules, DTOs, Mongoose schemas, and `test/` integration suites.
- `apps/web`: Next App Router application with feature folders for auth, projects, tasks, and comments; shared UI primitives and layout components.
- `packages/shared`: domain enums, constants, response interfaces; `src/index.ts` exports them. Its `package.json` points consumers at compiled `dist` output.
- `packages/tsconfig` and `packages/eslint-config`: shared compiler and lint conventions.
- `pnpm-workspace.yaml`: `apps/*` and `packages/*`; approved build dependencies include mongodb-memory-server, sharp, esbuild, and native tooling. `.npmrc` enables automatic peer installation and disables strict peer checks.
- Root `package.json`: dev/build/lint/test/typecheck through Turbo, filtered API seed, and workspace-wide Prettier commands. `turbo.json` builds upstream dependencies, caches build outputs, and makes dev persistent and seed uncached; root `.env` and named environment variables participate in task configuration.
- `Technical Assessment/` initially contained only the authoritative Markdown brief, untracked. No repository `AGENTS.md`, Docker setup, migration directory, or CI workflow was found in the inspected file inventory.

## 2. Technology Stack

Versions are declarations in the package manifests, not claims about latest releases or runtime installation: Node `>=20.19`, pnpm `10.33.0`, TypeScript `5.9.3`, Turbo `2.10.12`; API NestJS `11.2.3`, Mongoose `8.24.4`, bcryptjs `3.0.3`; web Next `16.3.4`, React `19.2.8`, TanStack Query `5.102.8`, React Hook Form `7.87.0`, Zod `4.5.4`, Tailwind `4.3.3`, Radix primitives, Phosphor icons, Sonner. See root, API, and web `package.json` files. API tests use Jest, ts-jest, Supertest, and mongodb-memory-server. README requests MongoDB 7+; the installed database version/topology is unverified.

## 3. Backend Architecture

`apps/api/src/main.ts::bootstrap` creates `AppModule`, enables Helmet and configured-origin CORS, and installs `ValidationPipe` with whitelist, forbidden unknown properties, transformation, and implicit conversion disabled. API port defaults to 4732. `app.module.ts::AppModule` registers configuration, MongoDB, all domain modules, global `JwtAuthGuard`, and `AllExceptionsFilter`.

Controllers translate HTTP input, use `CurrentUser`, parse IDs with `common/utils/object-id.ts::toObjectId`, and delegate to services. DTO classes use class-validator; pagination explicitly converts numeric input. Business logic and model access live in services. Modules register models via `MongooseModule.forFeature`; `ProjectsModule` exports project access and model providers, while `TasksModule` exports `TasksService` and its model providers. `CommentsModule` imports tasks, projects, and users. There is no separate repository abstraction.

`common/filters/http-exception.filter.ts::AllExceptionsFilter` returns `{statusCode,message,error}` for HTTP exceptions, joins validation messages, logs unexpected failures, and returns generic 500 responses. It does not specifically translate Mongo duplicate-key errors. `common/utils/serialize.ts::toUserSummary` selects public user fields and stringifies IDs; service serializers emit ISO dates.

## 4. Frontend Architecture

`apps/web/src/app/layout.tsx::RootLayout` installs Inter, `QueryProvider`, and Sonner. `/` redirects to `/projects`; `/login` renders `LoginForm`. `(app)/layout.tsx` wraps protected-page content in client `AppShell`. Project and task pages await route params and delegate to `ProjectView` and `TaskView`.

`features/*/api.ts` uses `lib/api-client.ts::apiRequest`; `features/*/hooks.ts` owns TanStack Query requests and invalidation; components render them. `lib/query-keys.ts::queryKeys` centralizes cache identity. `QueryProvider` uses 30-second stale time, no refetch on window focus, and no retries for API errors below 500; other query errors get limited retries. `useCurrentUser` overrides stale time to five minutes. TypeScript response types are assertions at the API-client boundary, not runtime response validation.

`LoginForm` and `CreateTaskDialog` use React Hook Form and Zod; `CommentForm` uses local state and explicit trimmed-length checks. There is no assignment/activity feature or dedicated client permission helper in the inspected feature tree.

## 5. Authentication

`auth/auth.controller.ts::AuthController` exposes public register/login and protected `/auth/me`. `AuthService.register` checks email, hashes passwords with bcrypt cost 12, and creates a user; registration does not create organization membership. `login` compares the stored hash. `buildSession` signs JWT `{sub,email}`; `auth.module.ts` configures secret and expiry (default 7d).

Global `common/guards/jwt-auth.guard.ts::JwtAuthGuard.canActivate` checks `@Public()` metadata, extracts a Bearer token, verifies it, and attaches `{id:payload.sub,email}` to `request.user`. `CurrentUser` reads that object. The guard does not query user existence or roles. Roles are resolved from database memberships by domain services. `/auth/me` loads the user and organization memberships.

`web/src/lib/auth-storage.ts` stores the access token in localStorage. `apiRequest` attaches it; `useLogin` saves it and redirects, and `useLogout` removes it and clears the query cache. `AppShell` redirects on missing session or current-user query errors. This is client navigation handling, not the API authorization boundary. No refresh/revocation flow was found in `AuthController`, `AuthService`, or auth client code.

## 6. Authorization

`projects/project-access.service.ts::resolve` loads the actual project, then queries its organization role and explicit project role concurrently. `canView` accepts organization OWNER/ADMIN or any project role. `canManage` accepts organization OWNER/ADMIN or PROJECT_MANAGER. `assertCanView` returns 403 for denied access; missing projects produce 404. `assertCanManage` first requires view access. `Organization.ownerId` alone does not confer permissions in these functions.

| Actor in the relevant scope | Read project/tasks/comments; create task/comment | General task PATCH | Delete task; add project member | Create project |
| --- | --- | --- | --- | --- |
| Organization OWNER | Yes, even without project row | Yes | Yes | Yes in own organization |
| Organization ADMIN | Yes, even without project row | Yes | Yes | Yes in own organization |
| PROJECT_MANAGER | Yes in that project | Yes | Yes | Only with elevated organization role |
| Project MEMBER | Yes | Only if task creator | No | No without elevated organization role |
| Organization MEMBER without project membership | No | No | No | No |
| Authenticated outsider | No | No | No | No |

Evidence: `ProjectsService.create/addMember`, `ProjectAccessService`, `TasksService.findByProject/create/findOne/update/remove`, and `CommentsService.findByTask/create`. These are source-established policies, not test execution results.

**Status-route exception:** `tasks/tasks.controller.ts::updateStatus` accepts task ID and DTO but no current user; `TasksService.updateStatus` loads by ID, sets status, saves, and serializes without any project-access call. Global JWT authentication still applies. This missing authorization is confirmed by source inspection. A successful outsider HTTP request and persisted mutation were **not reproduced** in this phase; the reported production incident is therefore **suspected, not runtime-confirmed**. A proposed reproduction belongs in the implementation plan. General PATCH and DELETE instead resolve authorization from the stored task's `projectId`.

Explicit membership and elevated organization access must not be conflated: the brief permits elevated roles to assign others, but the target assignee must be a project member. Changing all access checks to require explicit membership would remove intentional owner/admin access.

## 7. Organization Model

`organizations/schemas/organization.schema.ts::Organization`: name, unique normalized slug, ownerId User reference, timestamps. `organization-members/schemas/organization-member.schema.ts::OrganizationMember`: organizationId, userId, OWNER/ADMIN/MEMBER role, timestamps; unique membership pair. `OrganizationsService.findForUser` joins membership roles onto organization summaries. `OrganizationsController` only exposes authenticated `GET /organizations`; no organization creation or membership management endpoint was found. Seed/test fixtures create these records directly.

## 8. Project Model

`projects/schemas/project.schema.ts::Project`: organizationId, name, uppercase key, nullable description, createdBy, timestamps. Key is unique within an organization, not globally. `ProjectsService.findAllForUser` combines elevated-organization IDs and explicit member-project IDs, then batches member/task counts. `findOne` includes organization and creator. `create` requires an elevated organization role, checks duplicate key, inserts project, then inserts creator as PROJECT_MANAGER. These two writes have no transaction.

## 9. Project Membership

`project-members/schemas/project-member.schema.ts::ProjectMember` stores projectId/userId/role with PROJECT_MANAGER or MEMBER (default). `ProjectMembersService.findRole/findExisting` query the pair; `findByProject` sorts by creation time; `countByProjects` aggregates counts. `ProjectsService.addMember` requires management permission, an existing user, membership in the project's organization, and no existing project row. `findMembers` requires view access and batch-fetches users. `GET /projects/:projectId/members` returns `{id,projectId,role,user,createdAt}[]`: `id` is the membership ID, `user.id` is the user ID. They must not be confused in the future selector. No membership removal endpoint was found.

## 10. Task Domain

`tasks/schemas/task.schema.ts::Task`: projectId, number (minimum 1), uppercase key, trimmed title (max 200), nullable description, status (default TODO), priority (default MEDIUM), createdBy User reference, timestamps. `packages/shared/src/tasks.ts` defines TODO/IN_PROGRESS/IN_REVIEW/DONE and LOW/MEDIUM/HIGH/URGENT. There is no assignee or activity schema.

`CreateTaskDto` validates title length 3–200, optional description up to 5000, status and priority. `UpdateTaskDto` allows those fields individually; `UpdateTaskStatusDto` requires status. `ListTasksQueryDto` extends pagination with status/priority filters. Unknown input properties are rejected by the global validation pipe. `packages/shared/src/api.ts::TaskSummary` includes creator and commentCount; `TaskDetail` adds description and a small project object. Mongo IDs, human keys, and per-project numbers are distinct identifiers.

## 11. Task Lifecycle

1. `web/.../CreateTaskDialog` validates form, then `useCreateTask` calls `createTask` -> `POST /projects/:projectId/tasks`.
2. `JwtAuthGuard` authenticates; validation checks `CreateTaskDto`; `TasksController.create` parses IDs and passes authenticated user.
3. `TasksService.create` calls `assertCanView`, counts existing project tasks, assigns count + 1 and `${project.key}-${number}`, and inserts the task. Mongoose supplies `_id`, defaults, and timestamps.
4. `toDetail` invokes `toSummaries`: batch-fetch creators and aggregate comment counts, serialize, then attach project details. Missing creators use an Unknown user fallback.
5. `findByProject` checks access, applies optional filters, sorts by number ascending, skips/limits, counts total, and serializes. Pagination defaults to page 1 / 25, maximum pageSize 100 (`common/dto/pagination.dto.ts`, shared constants).
6. `findOne` loads the task and checks its actual project; `findTaskOrFail` alone checks existence only and is deliberately insufficient for authorization.
7. General `update` requires project view plus creator or manager, applies supplied fields, then saves. Status-only `updateStatus` omits project authorization as described above.
8. `remove` requires management, then concurrently deletes comments and task. There is no transaction or activity cleanup today.
9. `CommentsService` loads the task, checks actual-project view access, and creates or pages comments. Author summaries use one batch query, not one per record.
10. Existing task tests are six API integration cases in `apps/api/test/tasks.e2e.spec.ts`: member creation, sequential numbering, outsider create denial, outsider list denial, short-title validation, and status filtering. They do not cover mutation routes.

## 12. Database Design

`AppModule` configures Mongoose with `MONGODB_URI` only; `config/env.validation.ts::validateEnvironment` requires this and JWT_SECRET, validates a positive integer API_PORT, and supplies other defaults. API reads `../../.env` then `.env`; `web/next.config.ts` loads root `.env`. The existing local `.env` key names match the example; values were not exposed in this reconnaissance. Actual reachability, data, indexes, and topology remain unverified.

| Collection / schema file under `apps/api/src` | References | Declared indexes beyond default `_id` |
| --- | --- | --- |
| users / `users/schemas/user.schema.ts` | None | unique email |
| organizations / `organizations/schemas/organization.schema.ts` | ownerId -> User | unique slug |
| organization_members / `organization-members/schemas/organization-member.schema.ts` | organizationId -> Organization; userId -> User | individual FK indexes; unique (organizationId,userId) |
| projects / `projects/schemas/project.schema.ts` | organizationId -> Organization; createdBy -> User | organizationId; unique (organizationId,key) |
| project_members / `project-members/schemas/project-member.schema.ts` | projectId -> Project; userId -> User | individual FK indexes; unique (projectId,userId) |
| tasks / `tasks/schemas/task.schema.ts` | projectId -> Project; createdBy -> User | projectId; (projectId,status); (projectId,number), **nonunique**; createdAt descending |
| comments / `comments/schemas/comment.schema.ts` | taskId -> Task; authorId -> User | taskId; (taskId,createdAt ascending) |

All seven schemas use timestamps and explicit collection names. User passwordHash is excluded from default selection and removed by a toJSON transform; login explicitly selects it. References are resolved manually through services/queries in the inspected paths; no foreign-key enforcement or cascade middleware was found. No database sessions, transactions, counter allocator, or explicit index migration routine was found in API source/tests.

`database/seed.ts::seed` connects using root environment, deletes all seven collections' documents, then inserts five users, one organization, two projects, four project memberships, nine tasks, and five comments. Tasks are explicitly numbered ENG-1..6 and WEB-1..3. Seed is destructive and was not run. Its task descriptions are sample data, not additional assessment requirements. `README.md` documents local Mongo startup and seed; Docker is not required by the starter.

## 13. Task Numbering

`TasksService.create` performs separate count and insert operations. With n existing tasks, requests A and B may both read n before either insert and both save number n+1 and the same human key. `TaskSchema` has no unique constraint to reject that pair. Therefore the algorithm is not concurrency-safe by inspection; no concurrent workload was run.

Deletion independently breaks numbering: with numbers 1,2,3, deleting 2 leaves count 2, so the next create uses 3 again. Deleting the highest number permits its reuse. Counting is neither a high-water mark nor an atomic allocator. Project keys may repeat across organizations, so human task keys can legitimately repeat across organizations; a future uniqueness constraint must preserve project scope. Mongo `_id` is the identifier used by task routes. No counter field exists on `Project` and seed/fixtures bypass `TasksService.create`.

## 14. Frontend Task Flow

`ProjectView` queries project, members, and tasks. `features/tasks/api.ts::fetchProjectTasks` always requests page 1, pageSize 100; `TaskBoard` groups returned items into status sections and `TaskRow` links to task details. It does not load further pages or use total to retrieve omitted tasks. Row avatars currently show creators.

`TaskView` loads by taskId and renders title, description, comments, status selector, priority, creator, and date. The route projectId supplies the back link and status invalidation target; it is not checked against returned `task.projectId`. This can cause navigation/cache mismatch, while backend task authorization still uses the stored project on protected paths.

`TaskStatusSelect` is disabled only while pending and shows toast errors. `useUpdateTaskStatus` waits for success, sets detail cache to the server response, and invalidates project tasks; there is no optimistic update or role gating. `useCreateTask` invalidates project tasks and the projects prefix. The general `updateTask` API helper exists but no corresponding mutation hook/editor is wired in the inspected task components. No task-delete UI was found.

`CommentList` is a reusable visual reference for history states, but `fetchTaskComments` fetches only the first 50 comments, oldest first. `useCreateComment` invalidates task/comments; it does not explicitly refresh project-list comment counts. `useProjectMembers` already supplies member options; `useCurrentUser` supplies organization roles, and project membership entries supply project roles. `TaskDetail.project` does not contain organizationId; resolving UI assignment permissions can use `useProject` or a deliberately added capability response.

## 15. Testing Architecture

`apps/api/jest.config.js` transforms TypeScript with ts-jest using `tsconfig.test.json`. `package.json::test` runs in band with passWithNoTests. `test/global-setup.ts` starts one `MongoMemoryServer` (not a replica-set fixture), sets test URI and auth environment; teardown stops it. `test/utils/test-app.ts::createTestApp` compiles actual AppModule and installs validation. It does not execute production `bootstrap` (Helmet/CORS/listen). `resetDatabase` deletes documents between cases.

`test/utils/fixtures.ts` registers users over HTTP and inserts organizations/members/projects/tasks directly through raw collections. Thus fixtures bypass Mongoose defaults and service invariants. Four suites contain 20 cases: auth 4, projects 5, tasks 6, comments 5. No web test script or frontend test files were found. No baseline test result is claimed: tests were inspected, not executed. Future concurrency tests must await required index creation and must not rely only on mocked models; fixture setup must evolve if counters or transactions are introduced.

## 16. Existing Conventions

`.prettierrc`: semicolons, single quotes, trailing commas, 100-column width, two spaces, LF. `packages/tsconfig/base.json`: strict typing, unchecked-index checks; Nest enables decorator metadata and relaxes property initialization. `packages/eslint-config/base.js` forbids explicit any and enforces type imports; Nest config disables the latter for runtime injection metadata.

Use thin controllers, service-level policy, DTO validation, shared response interfaces, typed model injection, batched enrichment, centralized query keys, pending/error UI, and existing semantic color tokens. `app/globals.css` provides light/dark system palettes, compact radii, focus outlines, and Inter-based typography; `components/ui` wraps Radix Select/Dialog/Avatar with compact 12–13px task content, borders, skeletons, and empty states. Task detail becomes a two-column layout at lg; AppShell uses desktop sidebar/mobile drawer. These are source observations, not a rendered accessibility audit.

Git inspection: branch `main`, HEAD `27c84d89830b1e3bce6ea75c413bdfe90cc3473f`, tracking `origin/main`; origin is the starter repository. Recent history uses conventional prefixes (`fix`, `chore`, `style`, `docs`, `test`, `feat`), e.g. `fix: update import paths for routes and root-params to use dev directory`, `test: add api coverage for auth, projects, tasks and comments`. Local Git settings include ignorecase=true, symlinks=false, filemode=false. Git warned that the global ignore file was unreadable; local status/history were available. Initial status contained only untracked `Technical Assessment/`; no tracked modifications were reported. `.gitignore` excludes environment secrets, build outputs, dependencies, and caches. No commits were created.

Preserve these exact user-specified messages for corresponding later work:

```text
feat: add task assignment domain logic
feat: implement task activity history
fix: enforce project membership on task mutations
fix: make project task numbering concurrency-safe
test: add task authorization regression coverage
```

## 17. Important Files

| Concern | Starting points and symbols |
| --- | --- |
| Specification | `Technical Assessment/ET-Fullstack-Assessment-ProjectFlow.md`, sections 05–13 for feature/bug/tests, 14–26 for review/docs/submission |
| Entry and configuration | `apps/api/src/main.ts::bootstrap`, `app.module.ts::AppModule`, `config/env.validation.ts::validateEnvironment` |
| Auth | `apps/api/src/auth/auth.service.ts::AuthService`, `common/guards/jwt-auth.guard.ts::JwtAuthGuard` |
| Access | `apps/api/src/projects/project-access.service.ts::ProjectAccessService/canView/canManage` |
| Membership | `apps/api/src/project-members/project-members.service.ts::findExisting/findRole`, `projects/projects.service.ts::findMembers/addMember` |
| Task mutations | `apps/api/src/tasks/tasks.controller.ts::TasksController`, `tasks.service.ts::TasksService`, `dto/` |
| Task storage | `apps/api/src/tasks/schemas/task.schema.ts::TaskSchema`, `projects/schemas/project.schema.ts::ProjectSchema` |
| Existing history-like API | `apps/api/src/comments/comments.service.ts::findByTask/toEntries` |
| Shared contracts | `packages/shared/src/api.ts`, `roles.ts`, `tasks.ts`, `constants.ts` |
| Task UI and cache | `apps/web/src/features/tasks/components/task-view.tsx::TaskView`, `features/tasks/hooks.ts`, `lib/query-keys.ts` |
| Fixtures and seed | `apps/api/test/utils/fixtures.ts`, `apps/api/src/database/seed.ts::seed` |

Paths abbreviated in this table's second and subsequent entries retain the full directory context shown in the same cell.

## 18. Potential Risks

See `Technical Assessment/RISK_REGISTER.md` for evidence and prioritization. Principal risks: missing status authorization; count-based duplicate/reused identifiers; untested mutation boundaries; UI truncation at 100 tasks / 50 comments; nontransactional dependent writes; and raw database conflicts becoming generic 500s. Source evidence confirms the missing checks and algorithms, not a reproduced incident, production exploit, deployed index state, or observed data loss. Unassignment policy, status mutation policy, and future task/activity consistency require explicit engineering decisions before implementation.

NO APPLICATION SOURCE CODE WAS MODIFIED DURING THIS PHASE.
