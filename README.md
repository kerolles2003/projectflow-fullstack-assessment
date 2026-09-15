# ProjectFlow

ProjectFlow is a lightweight project and task tracker for software teams.
Organizations own projects, projects own tasks, and tasks carry a status, a
priority and a discussion thread.

It is a TypeScript monorepo: a NestJS + MongoDB API and a Next.js App Router
frontend, sharing a small package of domain types and enums.

---

## Technology stack

| Area         | Choice                                           |
| ------------ | ------------------------------------------------ |
| Monorepo     | pnpm workspaces + Turborepo                      |
| Language     | TypeScript 5.9                                   |
| API          | NestJS 11, Mongoose 8, MongoDB                   |
| Auth         | JWT bearer tokens, bcrypt password hashing       |
| Web          | Next.js 16 (App Router), React 19                |
| Styling      | Tailwind CSS 4, Radix primitives, Phosphor Icons |
| Server state | TanStack Query 5                                 |
| Forms        | React Hook Form + Zod                            |
| Testing      | Jest, Supertest, mongodb-memory-server           |

---

## Prerequisites

- **Node.js 20.19+** (22 or 24 recommended)
- **pnpm 10.33.0**, pinned by `packageManager` in root package.json.
- **MongoDB 7+ with transaction support**: a replica set or sharded cluster.
- **Docker Desktop/Engine** if using the disposable local MongoDB recipe below.

Assignment and activity use multi-document transactions; a reachable standalone
MongoDB server is not sufficient. Automated tests create their own
MongoMemoryReplSet and do not require Docker. The Docker path below is for local
runtime/manual verification, not a production deployment procedure.

---

## Installation

```bash
pnpm install
```

## Environment setup

Configuration lives in a single `.env` file at the repository root; both apps
read it. Copy the tracked example, then edit the values for your local runtime.
Do not commit `.env` or real credentials.

```powershell
Copy-Item .env.example .env
```

In Git Bash or Unix-like shells, `cp .env.example .env` is equivalent.

| Variable              | Purpose                                         | Default                                                                                                      |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `MONGODB_URI`         | Required transaction-capable MongoDB connection | `mongodb://127.0.0.1:<published-port>/projectflow?replicaSet=rs0&directConnection=true` (local recipe below) |
| `JWT_SECRET`          | Signing secret for access tokens                | — (required)                                                                                                 |
| `JWT_EXPIRES_IN`      | Access token lifetime                           | `7d`                                                                                                         |
| `API_PORT`            | Port the API listens on                         | `4732`                                                                                                       |
| `WEB_ORIGIN`          | Origin allowed by CORS                          | `http://localhost:3742`                                                                                      |
| `NEXT_PUBLIC_API_URL` | API base URL used by the browser                | `http://localhost:4732`                                                                                      |

The API refuses to boot if `MONGODB_URI` or `JWT_SECRET` is missing. The example's
signing value is a local placeholder; choose your own secret for any shared runtime.
`NODE_ENV` defaults to development. `WEB_PORT` is an optional shell input to the
web script, not an API setting. A URI alone does not establish transaction support;
the server must actually be configured as a replica set or sharded cluster.

## Database

### Local disposable replica set

The assessment used the following Docker approach successfully in PowerShell
with an existing `mongo:7` image. On a clean machine, obtain that official image
first; `--pull never` deliberately fails if it is absent.

```powershell
docker info --format '{{.ServerVersion}} {{.OSType}}'
docker run --detach --rm --pull never --name projectflow-local --publish 127.0.0.1:0:27017 --tmpfs /data/db --tmpfs /data/configdb mongo:7 --replSet rs0 --bind_ip_all
docker port projectflow-local 27017
'rs.initiate({_id:"rs0",members:[{_id:0,host:"localhost:27017"}]})' | docker exec -i projectflow-local mongosh --quiet
```

Wait until MongoDB is ready before initialization; retry initialization if the
shell cannot yet connect. Use the published host port from `docker port` in the
root `.env`, replacing `<published-port>`:

```text
MONGODB_URI=mongodb://127.0.0.1:<published-port>/projectflow?replicaSet=rs0&directConnection=true
```

This exposes only a loopback port and uses disposable in-memory container
storage. Stop it after use with `docker stop projectflow-local`; its data is lost.
No production credentials or host database are needed.

### Transaction boundary

Task assignment and TaskActivity are stored separately. Relevant policy reads,
task writes and activity insertion use the same session in one MongoDB
transaction. Activity insertion failure rolls back the task mutation; success
is returned after commit. A single-node replica set supports local verification,
not production availability/failover claims.

### Seed data

Make sure the replica set is ready and `.env` points to disposable local data,
then load development data:

```bash
pnpm seed
```

The seed clears users, organizations, memberships, projects, tasks and comments,
then inserts development fixtures. It does not clear `task_activities`; use a
fresh disposable database for a clean reset. Never use this destructive seed on
retained/production data. These fixtures are not production data. Turbo builds
the required packages before seeding.

### Existing retained databases

There is no formal migration framework or migration script. Before rollout,
initialize/reconcile `Project.lastTaskNumber` against existing task numbers,
inspect/resolve duplicates and replace any existing nonunique task-number index
with unique `{ projectId: 1, number: 1 }`. Do not lower a retained counter or use
seed as migration. Disposable test success does not verify production migration.

## Running the apps

The root command now uses a Node launcher for web development, so port selection
does not depend on shell expansion:

```bash
pnpm dev
```

This command was verified in Windows Git Bash after commit `08d5ad5`: the web
server returned HTTP 200 on port **3742**, and the API started on **4732** with
its protected endpoint returning the expected unauthenticated 401. API port
selection still uses `API_PORT`. Unix/macOS/Linux execution was not tested.

To override the web port in Git Bash:

```bash
WEB_PORT=3800 pnpm dev
```

That override was also verified with web HTTP 200 on 3800 and API still on 4732.
For PowerShell, set the environment variable before the same root command:

```powershell
$env:WEB_PORT = '3800'
pnpm dev
```

Update `WEB_ORIGIN` in `.env` to match the chosen web origin. If changing
`API_PORT`, update `NEXT_PUBLIC_API_URL` too. `WEB_PORT` is passed through Turbo
to dev tasks; an unset/empty value defaults to 3742. Stop with Ctrl+C; the tested
Windows run needed a second Ctrl+C for lingering Turbo tasks before shutdown
completed. Verification confirmed the listening ports were released.

Run the apps separately if preferred:

```bash
pnpm --filter @projectflow/api dev
pnpm --filter @projectflow/web dev
```

If PowerShell blocks a package-manager `.ps1` shim, use the installed `.cmd` shim.
The `npm.cmd` alternative was verified for per-app checks; it does not require
changing execution policy. The separate web production `start` script still uses
its original shell syntax; the verified cross-platform change covers `dev`.

## From a clean checkout

Start the replica set above (or provide an existing transaction-capable local
server), then:

```powershell
pnpm install
Copy-Item .env.example .env
# Edit MONGODB_URI and JWT_SECRET before continuing.
pnpm seed
pnpm dev
```

These are setup instructions checked against workspace configuration, not a claim
that a fresh-machine installation was exercised.

---

## Commands

| Command          | Description                                |
| ---------------- | ------------------------------------------ |
| `pnpm dev`       | Run the API and web app in watch mode      |
| `pnpm build`     | Build every package and app                |
| `pnpm lint`      | ESLint across the workspace                |
| `pnpm typecheck` | TypeScript project-wide, no emit           |
| `pnpm test`      | API test suite (uses an in-memory MongoDB) |
| `pnpm seed`      | Reset and reload development data          |
| `pnpm format`    | Prettier write                             |

`pnpm test` uses Jest/Supertest and starts a disposable single-node wiredTiger
MongoDB replica set through `MongoMemoryReplSet`. The first run requires network
access to download and cache a MongoDB binary; download size varies. Existing
global setup supplies the isolated test URI; teardown stops the replica set.

### Latest recorded verification

The latest fresh root run was `pnpm test --force`: **4 suites passed, 50 tests
passed, 0 failed, 0 skipped**, with Jest reporting 101.848 seconds. Plain
`pnpm test` also succeeded but replayed Turbo cache; `--force` executed the tests.
The existing MongoMemoryReplSet global setup/teardown supplied a real disposable
transaction-capable database. Tests cover assignment authorization, unauthorized
task mutations, transaction rollback, concurrent numbering/project isolation,
activity access/pagination/order and actual index assertions. The intentional
rollback test emits an expected database validation error while passing.

The tested E6 refinements are now committed in `8a08ab8`, the implementation HEAD
at this documentation pass. Root `pnpm typecheck` and `pnpm build` passed after
the dev-port fix. `pnpm lint` is the root lint entry point; API and web lint were
verified through their respective `npm.cmd run lint` scripts during E6. Frontend
typecheck/build also passed. The build needs access to its existing Google font
dependency. No tests were rerun during this documentation edit.

Focused changed-file formatting passed; broader checks found existing failures
in replica-set setup files and unchanged starter components.

`pnpm format:check` is available for a non-writing workspace formatting check.
Avoid mass-formatting unrelated starter code solely to make that check green.

---

## Development credentials

Seeded accounts, all sharing the password `Password123!`:

| Name         | Email                 | Access                    |
| ------------ | --------------------- | ------------------------- |
| Ammar Yaser  | `ammar@example.com`   | Organization owner        |
| Sarah Ahmed  | `sarah@example.com`   | Organization admin        |
| Ahmed Hassan | `ahmed@example.com`   | Project manager on `ENG`  |
| Magd Ali     | `magd@example.com`    | Member of `ENG` and `WEB` |
| Outside User | `outside@example.com` | No organization           |

These are local development accounts only.

---

## Architecture

```
projectflow/
├── apps/
│   ├── api/                     NestJS API
│   │   ├── src/
│   │   │   ├── auth/            register / login / current user
│   │   │   ├── users/
│   │   │   ├── organizations/
│   │   │   ├── organization-members/
│   │   │   ├── projects/        projects + ProjectAccessService
│   │   │   ├── project-members/
│   │   │   ├── tasks/
│   │   │   ├── comments/
│   │   │   ├── common/          guards, decorators, filters, shared DTOs
│   │   │   └── database/seed.ts
│   │   └── test/                e2e suites and fixtures
│   │
│   └── web/                     Next.js App Router frontend
│       └── src/
│           ├── app/             routes and layouts
│           ├── components/      design system primitives + app shell
│           ├── features/        auth, projects, tasks, comments
│           ├── lib/             API client, query keys, formatting
│           └── providers/       TanStack Query provider
│
└── packages/
    ├── shared/                  enums, constants, API response types
    ├── eslint-config/           flat ESLint configs
    └── tsconfig/                base TypeScript configs
```

### API layering

Each module follows the same shape: controller → service → Mongoose model, with
DTOs validating input at the boundary. Controllers stay thin; business rules
live in services.

### Domain model

```
User
Organization        ── OrganizationMember ── User      (OWNER | ADMIN | MEMBER)
Organization  ── Project
Project             ── ProjectMember      ── User      (PROJECT_MANAGER | MEMBER)
Project       ── Task ── Comment
                   └── TaskActivity
```

Membership is stored in its own collection rather than as arrays on the parent
document, so it can be indexed and queried directly. Both membership
collections carry a unique compound index on their two foreign keys.

Tasks are numbered per project and identified by a human-readable key derived
from the project key: `ENG-1`, `ENG-2`, `WEB-1`.

### Authorization

`ProjectAccessService` answers "may this user touch this project?" in one
place. Access comes from either an elevated organization role (`OWNER` or
`ADMIN`, which grants access to every project in the organization) or an
explicit project membership row. `assertCanView` gates reads, `assertCanManage`
gates configuration and membership changes.

Authentication is a JWT bearer token. `JwtAuthGuard` is registered globally;
routes opt out with the `@Public()` decorator. JWT identifies the caller;
ProjectAccessService enforces project authorization. Task-scoped operations use
the loaded task's stored `projectId`, not client-supplied project context. Status
mutation now forwards authenticated identity and checks access before saving.

### API surface

```
POST   /auth/register
POST   /auth/login
GET    /auth/me

GET    /organizations

GET    /projects
POST   /projects
GET    /projects/:projectId
GET    /projects/:projectId/members
POST   /projects/:projectId/members

GET    /projects/:projectId/tasks
POST   /projects/:projectId/tasks
GET    /tasks/:taskId
PATCH  /tasks/:taskId
PATCH  /tasks/:taskId/status
PATCH  /tasks/:taskId/assignee
GET    /tasks/:taskId/activity
DELETE /tasks/:taskId

GET    /tasks/:taskId/comments
POST   /tasks/:taskId/comments
```

Errors share one shape:

```json
{
  "statusCode": 403,
  "message": "You do not have access to this project",
  "error": "Forbidden"
}
```

### Frontend

Routes are thin; the work happens in `features/`. Server state is owned by
TanStack Query — query keys live in `lib/query-keys.ts` so invalidation stays
predictable — and local UI state stays in React. The API client in
`lib/api-client.ts` centralises the base URL, the auth header and error
parsing.

Components are server components by default; `"use client"` is added only where
interactivity or hooks require it.

## Assessment features and technical decisions

- **Assignment:** `PATCH /tasks/:taskId/assignee` accepts `{assigneeId: "<user-id>"}`
  or explicit null. The target must be a member of the stored task project.
  OWNER/ADMIN/PROJECT_MANAGER can assign eligible members and clear assignments;
  MEMBER can self-assign and clear their own assignment. Validated no-ops create
  no event. Assignee and creator remain separate.
- **Activity:** `GET /tasks/:taskId/activity` defaults to page 1/pageSize 25 (max
  100), authorizes project access and sorts by createdAt descending then \_id
  descending. `{taskId:1, createdAt:-1, _id:-1}` supports the read pattern.
  Actor/from/to users are loaded in one batch per nonempty page, avoiding N+1;
  missing users retain an Unknown user identity and sensitive fields are excluded.
- **Numbering:** atomic `Project.lastTaskNumber` increment replaces count-based
  allocation; unique `{projectId:1, number:1}` protects project-scoped numbers.
  Deletion does not decrement/reuse numbers. Failed inserts may leave gaps.
- **Consistency:** separate activity storage keeps history independently pageable;
  the shared transaction prevents a task change without its matching event.
- **Frontend:** the task detail includes project-member search, an assignee
  selector and readable activity timeline with explicit Load more. Assignment
  waits for the server-returned TaskDetail, updates the task cache and invalidates
  project/activity queries. Uncertain failures refetch canonical state. This
  avoids speculative assignee/history state; optimistic UI is not required.

Detailed rationale, review and scope decisions are in
[ASSESSMENT_NOTES.md](ASSESSMENT_NOTES.md). See [BUG_REPORT.md](BUG_REPORT.md) for the
status authorization issue and [AI_LOG.md](AI_LOG.md) for assisted-work disclosure.

## Known limitations

- Transaction-capable MongoDB is required; production topology was not verified.
- Retained databases require counter/index preparation; no formal migration framework exists.
- Activity uses offset pagination; no live stream, Redis, Kafka or queue infrastructure was needed for this scope.
- No browser automation suite was added. Browser smoke testing was manually performed by the candidate and reported as successful.
- Broader formatting checks retain pre-existing/unchanged failures; these are not evidence of production runtime failures.
- A clean-machine setup and production deployment have not been verified.
- Actual candidate elapsed time must be filled in ASSESSMENT_NOTES.md before submission; planning estimates are not actual time.
