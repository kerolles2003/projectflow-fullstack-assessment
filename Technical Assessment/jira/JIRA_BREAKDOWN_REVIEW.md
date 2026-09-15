# Jira Execution Breakdown Review — Revision 2

## 1. Sources and Hierarchy Summary

Primary execution authority: [approved IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md), including Selected Policies, Consistency Gate, Test Priority Tiers, budget and final order. Supporting evidence: [CODEBASE_MAP.md](../CODEBASE_MAP.md), [RISK_REGISTER.md](../RISK_REGISTER.md), and [original assessment](../ET-Fullstack-Assessment-ProjectFlow.md). All plan requirement numbers below refer to its 24 numbered requirements; CSV also names the relevant brief sections.

Revised [projectflow-assessment.csv](projectflow-assessment.csv): **7 Epics, 9 Tasks, 19 Sub-tasks, 35 issues total**. This is an execution hierarchy grouped around deliverable work, not one issue per assessment bullet. These are stable local IDs, not assigned Jira keys. All rows start **To Do**, Actual Time **0m**. No Jira project was accessed or imported.

Tasks are small deliverable containers with acceptance criteria; sub-tasks hold executable estimates. Epics and Tasks have **0m direct estimate**, not zero effort: their effort is the sum of their children. Log work at leaf level and avoid summing Jira aggregate estimates together with child estimates. Dependencies mean **this issue waits for the listed IDs**. Blank dependency means none; blank parent is valid only for Epics. A parent completes when required children finish; recommended/optional children may be explicitly deferred with the reason recorded. Revision 2 preserves all prior IDs and parents, adds PF-E6-T1-S3 for integrated verification, and transfers 10m from PF-E7-T1-S2 rather than increasing estimates.

## 2. Epic → Task → Sub-task Tree

```text
PF-E1 Baseline & Authorization Fix
  PF-E1-T1 Establish baseline and reproduce status authorization issue
    PF-E1-T1-S1 Record baseline and prepare disposable verification [10m, MUST-HAVE]
    PF-E1-T1-S2 Reproduce outsider status mutation with persisted evidence [15m, MUST-HAVE]
  PF-E1-T2 Fix status access boundary and protect mutations
    PF-E1-T2-S1 Pass authenticated actor into status service and check access [15m, MUST-HAVE]
    PF-E1-T2-S2 Add focused task mutation authorization regression tests [20m, MUST-HAVE]
PF-E2 Concurrency-Safe Task Numbering
  PF-E2-T1 Replace count-based task numbering and verify concurrency
    PF-E2-T1-S1 Implement project counter and unique numbering constraint [25m, MUST-HAVE]
    PF-E2-T1-S2 Verify parallel creation and project isolation [15m, MUST-HAVE]
PF-E3 Task Assignment Domain & Permissions
  PF-E3-T1 Resolve persistence gate and implement assignment policy
    PF-E3-T1-S1 Select topology and atomicity strategy before assignment [10m, MUST-HAVE]
    PF-E3-T1-S2 Implement assignment DTO, membership and unassignment policy [25m, MUST-HAVE]
PF-E4 Activity History & API
  PF-E4-T1 Persist assignment history atomically and test business rules
    PF-E4-T1-S1 Implement consistent assignee change and event persistence [20m, MUST-HAVE]
    PF-E4-T1-S2 Test assignment roles, transitions and failure atomicity [15m, MUST-HAVE]
  PF-E4-T2 Expose authorized paginated activity with batched users
    PF-E4-T2-S1 Add indexed activity API and safe enrichment [20m, MUST-HAVE]
    PF-E4-T2-S2 Test activity access and core paging contract [10m, MUST-HAVE]
PF-E5 Frontend Assignment & Timeline
  PF-E5-T1 Extend task detail with assignee selector and history
    PF-E5-T1-S1 Add minimal searchable selector and confirmed mutation [30m, MUST-HAVE]
    PF-E5-T1-S2 Render activity timeline and verify core UI states [20m, MUST-HAVE]
PF-E6 Testing & Quality
  PF-E6-T1 Verify integrated features, full suite and prioritized quality
    PF-E6-T1-S1 Complete compact recommended activity edge assertions [5m, STRONGLY RECOMMENDED]
    PF-E6-T1-S2 Optionally deepen existing UI or query checks [5m, NICE-TO-HAVE]
    PF-E6-T1-S3 Verify cross-feature integration, full suite and final technical diff [10m, MUST-HAVE]
PF-E7 Documentation & Final Submission
  PF-E7-T1 Prepare required documentation and final submission gate
    PF-E7-T1-S1 Consolidate assessment documentation and review exercises [20m, MUST-HAVE]
    PF-E7-T1-S2 Check documentation completeness and final submission readiness [5m, MUST-HAVE]
```

## 3. Budget and Time Controls

| Approved budget bucket | Sub-task allocation | Estimate | Approved range |
| --- | --- | --- | --- |
| Baseline / reproduction | PF-E1-T1 children | 25m | 20–30m |
| Authorization / regression | PF-E1-T2 children | 35m | 30–45m |
| Numbering / parallel tests | PF-E2-T1 children | 40m | 35–50m |
| Assignment + activity backend | PF-E3-T1 + PF-E4-T1 children | 70m | 60–75m |
| Activity API / tests | PF-E4-T2 children + PF-E6-T1-S1 | 35m | 25–35m |
| Frontend / core checks | PF-E5-T1 children + PF-E6-T1-S2 | 55m | 45–60m |
| Documentation / integrated verification / submission gate | PF-E7-T1-S1 (20m) + PF-E6-T1-S3 (10m) + PF-E7-T1-S2 (5m) | 35m | 30–45m |
| **Total, leaf estimates only** | **Includes both small quality timeboxes** | **295m (4h55)** | **245–340m** |

**MUST-HAVE estimated effort: 285m (4h45). STRONGLY RECOMMENDED separately estimated effort: 5m. NICE-TO-HAVE estimated effort: 5m. Total: 295m (4h55).** Strongly recommended assertions that naturally share core test fixtures are already included in those test estimates; do not count them again. Optional 5m buys one useful check with existing tools, not a new automation suite.

This fits the approved range but is not a promise of finishing within four hours. Hard cap remains **360 minutes cumulative assessment effort**, including applicable earlier exploration/planning. Actual prior effort is unknown; 0m in this CSV means no work logged to these future issues, not that prior assessment effort was zero. 295m leaves 65m against the cap only if no earlier effort applies. Reforecast based on actual time, test setup delays and conditional retained-data work. Issue estimates are effort timeboxes, not guarantees.

- Approaching 4h: stop nonessential polish and protect required correctness, backend/security/concurrency tests, core UX and documentation.
- Approaching 5h: defer optional frontend/test refinements; reserve the final 30–45m for docs/check completion and review.
- At 6h: stop, record incomplete requirements/failed or unrun checks, and do not claim complete verification.
- No unrelated refactor after required behavior works. Capture bug evidence, decisions, command results and AI usage as work happens; the final documentation estimate assumes consolidation of those notes.

## 4. Critical Path and Execution Order

The approved security-first **execution recommendation** remains baseline/reproduction, authorization fix/tests, numbering/tests, assignment after the consistency gate, activity persistence/API, frontend, documentation and final checks. A recommended single-engineer work order is not a technical blocking dependency. Independent work can proceed without waiting for an unrelated issue, subject to shared-file coordination; no parallel staffing or agent delegation is assumed.

**Mandatory total effort is 285m; all tiers total 295m.** The corrected dependency graph has a **130m (2h10) critical path** to final readiness, assuming independent branches can overlap:

```text
PF-E1-T1-S1 (10m)
→ PF-E3-T1-S1 (10m)
→ PF-E3-T1-S2 (25m)
→ PF-E4-T1-S1 (20m)
→ PF-E5-T1-S1 (30m)
→ PF-E5-T1-S2 (20m)
→ PF-E6-T1-S3 (10m)
→ PF-E7-T1-S2 (5m)
```

This mathematical path is not a two-hour single-engineer delivery estimate. Parallel branches still consume effort: authorization regression finishes at graph minute 60, numbering at 50, assignment tests at 80, activity API tests at 95, documentation preparation at 105, and UI at 115. Mandatory integration waits for all critical branches, finishes at 125, then final readiness at 130.

Dependency cleanup:
- Remove duplicate prerequisite lists from roll-up Tasks; only executable Sub-tasks have dependency edges.
- Numbering and topology inspection depend on baseline, not on completion of unrelated authorization or numbering work.
- API implementation depends on activity persistence; its local tests remain explicit prerequisites for integrated verification.
- Selector implementation depends on the functional assignment/history persistence surface. Timeline additionally depends on the activity API.
- Remove redundant transitive gate dependencies. The final submission gate depends directly on documentation preparation and mandatory integrated verification.
- No strongly recommended or nice-to-have issue is a predecessor of the final gate.

**Final gate reachability:** PF-E6-T1-S3 directly depends on PF-E1-T2-S2, PF-E2-T1-S2, PF-E4-T1-S2, PF-E4-T2-S2 and PF-E5-T1-S2. These connect transitively to baseline, reproduction, topology selection and all critical implementation. PF-E7-T1-S2 depends on PF-E6-T1-S3 and PF-E7-T1-S1. This makes documentation preparation independent of final readiness without bypassing any mandatory testing.

Assignment/history remain one release milestone. Do not expose a success-capable assignment endpoint until persistence and assignment regression checks are complete; UI coding before those tests finish does not authorize releasing it. Reproduction precedes the authorization fix. A non-reproduced outcome must be investigated and documented truthfully.

## 5. Test Tiers and Ownership

| Tier | Coverage | Owning issue(s) |
| --- | --- | --- |
| MUST-HAVE | Stored-project status regression, general PATCH and DELETE denial with persisted-state checks, intended positive roles | PF-E1-T2-S2 |
| MUST-HAVE | Parallel successful numbering, persisted uniqueness and independent projects | PF-E2-T1-S2 |
| MUST-HAVE | Member self-assignment, OWNER/ADMIN/PROJECT_MANAGER assigning members, member-other denial, nonmember target, explicit-null unassignment/own-only member rule, all three actor/from/to transitions | PF-E4-T1-S2 |
| MUST-HAVE | Failure atomicity of selected persistence branch | PF-E4-T1-S2 |
| MUST-HAVE | Unauthorized activity read denial; allowed viewer access | PF-E4-T2-S2 |
| MUST-HAVE | Cross-feature integration, full-suite/build/lint/typecheck confirmation, startup and final technical diff review | PF-E6-T1-S3 |
| STRONGLY RECOMMENDED | No-op has no event and createdBy remains unchanged | Compact assertions in PF-E4-T1-S2 |
| STRONGLY RECOMMENDED | Activity page boundaries, deterministic newest-first order, missing-user fallback | PF-E4-T2-S2 and PF-E6-T1-S1 |
| NICE-TO-HAVE | Detailed frontend automation, exact query counts, additional equal timestamps, extended responsive automation | PF-E6-T1-S2, capped optional selection |

These tiers prioritize **automation**, not whether required behavior is implemented. No-op correctness, ordering, pagination, user fallback, creator preservation and core accessibility still appear in feature acceptance criteria. If recommended automated checks are deferred, explicitly say so. Core manual UI validation (states, assign/clear refresh, keyboard and narrow layout) belongs in PF-E5-T1-S2. Use the existing Jest/Supertest/Mongo fixtures; mocks alone do not establish HTTP authorization or database correctness. No optional item blocks the critical path.

## 6. Dependency Map

Dependencies list stable IDs of executable prerequisites, separated by semicolons. All parent/roll-up dependency cells are intentionally blank. Parent relationships are hierarchy only, not dependency edges.

| Executable issue | Depends on completion of |
| --- | --- |
| PF-E1-T1-S1 | None |
| PF-E1-T1-S2 | PF-E1-T1-S1 |
| PF-E1-T2-S1 | PF-E1-T1-S2 |
| PF-E1-T2-S2 | PF-E1-T2-S1 |
| PF-E2-T1-S1 | PF-E1-T1-S1 |
| PF-E2-T1-S2 | PF-E2-T1-S1 |
| PF-E3-T1-S1 | PF-E1-T1-S1 |
| PF-E3-T1-S2 | PF-E3-T1-S1 |
| PF-E4-T1-S1 | PF-E3-T1-S2 |
| PF-E4-T1-S2 | PF-E4-T1-S1 |
| PF-E4-T2-S1 | PF-E4-T1-S1 |
| PF-E4-T2-S2 | PF-E4-T2-S1 |
| PF-E5-T1-S1 | PF-E4-T1-S1 |
| PF-E5-T1-S2 | PF-E5-T1-S1; PF-E4-T2-S1 |
| PF-E6-T1-S1 | PF-E4-T2-S2 |
| PF-E6-T1-S2 | PF-E5-T1-S2 |
| PF-E6-T1-S3 | PF-E1-T2-S2; PF-E2-T1-S2; PF-E4-T1-S2; PF-E4-T2-S2; PF-E5-T1-S2 |
| PF-E7-T1-S1 | PF-E4-T2-S1 |
| PF-E7-T1-S2 | PF-E7-T1-S1; PF-E6-T1-S3 |

Feature-specific tests remain attached to their implementation Tasks. Testing & Quality verifies integrated behavior, the full suite and the final technical diff, plus explicitly prioritized extra checks. Optional tests do not make required testing optional.

## 7. Preserved Policies and Assumptions

- Status calls assertCanView on **stored task.projectId**, preserving organization OWNER/ADMIN and explicit project-member access. General PATCH remains creator-or-manager after view access; DELETE remains management-only.
- Assignment's organization OWNER/ADMIN and project PROJECT_MANAGER may target other project members; MEMBER may self-assign including tasks created by others. Every non-null target needs explicit membership in the task's project. Actor permission and target eligibility are separate checks.
- Unauthorized actor → 403. Eligible actor with invalid/nonmember target → 400. Proposed dedicated endpoint requires assigneeId; explicit null clears, omission is invalid. Legacy absent assignee serializes null, creation stays unassigned, and createdBy stays intact.
- Approved **reasoned unassignment assumption**, not explicit brief wording: elevated managers clear any manageable assignment; MEMBER clears only their own. Already-null by an authorized project viewer is a no-op; repeated assignment produces no event while preserving policy checks.
- PF-E3-T1-S1 chooses actual topology before coding: prefer separate collection + transaction with minimal supported replica-set development/test setup; otherwise use the approved conditional single-document atomic fallback with explicit document-growth and query/index trade-offs. Never intentional assignee-only success, independent dual writes, or silent event truncation.
- Numbering uses database-coordinated per-project allocation and unique (projectId,number), with allowed gaps. Seed/fixture compatibility is necessary. Backfill/remediation is conditional on actual retained data; no large migration framework or silent renumbering.
- Frontend uses canonical task.projectId, existing project-member data and UI primitives, minimal separate labeled search when appropriate, server-confirmed updates, and refetch on ambiguous lost response. No default optimistic layer.
- Still evidence-dependent: Mongo topology/setup practicality, actual retained tasks/duplicates, accessibility behavior of the minimal composition, baseline failures, and actual remaining time. These are bounded decisions, not scope expansion.
- The local artifact-tool package was unavailable at the documented runtime dependency location. The requested plain CSV was authored as escaped text and validated with the shell CSV parser; no spreadsheet dependencies were installed. No workbook styling/formulas or extra XLSX were added to a Jira import file.

## 8. Jira CSV Import Compatibility

The existing 14-column CSV schema is retained. None of its informational columns is asserted to be a built-in Jira field. Configure mappings for the target instance; no import or field creation was performed.

| CSV column | Import treatment |
| --- | --- |
| Issue ID | Stable external identifier for import mapping; not a Jira key. Retain as custom/informational text if the importer requires numeric surrogate IDs. |
| Issue Type | Map Epic, Task and Sub-task to existing configured work types. |
| Summary | Native summary/title mapping. |
| Description | Native description mapping. |
| Priority | Map High/Medium/Low to configured priority values. |
| Status | Map To Do to a valid initial workflow state. |
| Parent ID | Map using the hierarchy-capable importer; Epic parents blank, Task parents Epic, Sub-task parents Task. |
| Phase | Informational/custom text or append to Description. |
| Labels | Split space-separated label tokens using the chosen importer's supported mapping. |
| Original Estimate | Native time tracking only after converting the retained minute strings to seconds where required. Parent 0m is direct effort only. |
| Actual Time | Informational/custom tracking initialized to 0m; use native Time Spent only with verified mapping, never fabricate a worklog. |
| Dependencies | Informational/custom text. Resolve external IDs to created keys and add supported links separately. |
| Assessment Requirement | Informational/custom text or preserve in Description. |
| Acceptance Criteria | Informational/custom text or preserve in Description; no universal built-in field is assumed. |


This is an import-ready **data breakdown**, not a claim that an unspecified Jira instance can import every field without mapping.

1. Use an importer supporting the requested hierarchy. Map Issue ID as the external work-item identifier, Issue Type to the configured type, and Parent ID to the corresponding parent relationship. Preserve these stable IDs in an external-ID field if the chosen importer needs numeric surrogate IDs; do not mistake them for assigned Jira keys. Parent rows precede children. Target project, issue types, priority names and To Do workflow must be checked during import. See [Atlassian hierarchy preparation](https://support.atlassian.com/jira-software-cloud/docs/prepare-a-csv-file-for-import/).
2. **Estimate conversion required for native fields:** the requested human values (e.g. 15m) are intentionally retained. Atlassian documents native CSV Original Estimate values in **seconds**. In an import mapping copy, convert minutes × 60 (15m → 900; 0m → 0); retain this source CSV. Actual Time is initially 0m; map to a suitable tracking/custom field or native Time Spent representation only after verifying the chosen importer. Do not create fake worklogs. See [Atlassian CSV field requirements](https://support.atlassian.com/jira-cloud-administration/docs/import-data-from-a-csv-file/).
3. Phase, Assessment Requirement, Acceptance Criteria, Actual Time, and Dependencies may need custom text fields or inclusion in Description during mapping. Do not silently drop these fields. Labels contains space-separated tokens; split them or map them using the target importer's supported multiple-value method.
4. Dependencies remain explicit local-ID text. Resolve to actual imported keys and configure links separately if the chosen importer cannot create them directly. No automatic linking is asserted.
5. UTF-8 comma-delimited CSV; all fields are quoted, embedded quotes escaped, blank Epic parents intentional. No formulas, synthetic Jira keys, user assignments, dates or credentials. File parsing and graph checks are local verification, not a live Jira import test. No Jira settings were changed.

## 9. Scope and Deferred-Work Protection

**OUT OF SCOPE / DEFERRED** unless implementation evidence makes a narrowly bounded change strictly necessary for requested correctness: existing task/comment pagination redesign, JWT refresh/revocation, app-wide transaction refactor, global caching, Docker without need, microservices, Kafka, outbox/event sourcing, unrelated error-handling cleanup, broad architecture rewrites. Optional deployment, historical-name snapshots, create-time assignment UI and a large UI/test dependency are not default work.

Record observations in later assessment notes/reflection rather than making new blocking issues. A scaling essay can discuss future infrastructure without implementing it. No issue authorizes source edits, commits or final deliverables **during this Jira-breakdown step**.

### Exact Future Commit Guidance

| Applicable work | Preserve exact message |
| --- | --- |
| PF-E3-T1-S2 | `feat: add task assignment domain logic` |
| PF-E4-T1-S1 | `feat: implement task activity history` |
| PF-E1-T2-S1 | `fix: enforce project membership on task mutations` |
| PF-E2-T1-S1 | `fix: make project task numbering concurrency-safe` |
| PF-E1-T2-S2 | `test: add task authorization regression coverage` |

Messages are guidance for later authorized implementation, not commits created now. Keep history focused; do not replace it with a single final commit unless there is a documented reason.

## 10. Complete Approved-Plan Requirement-to-Issue Audit

All entries below mean **represented in the breakdown**, not implemented or tested.

| Represented | Plan requirement | Owning issues |
| --- | --- | --- |
| [x] | 1. Task assignment | PF-E3-T1-S2; PF-E4-T1-S2 |
| [x] | 2. Assignment permissions | PF-E3-T1-S2; PF-E4-T1-S2 |
| [x] | 3. Project membership restriction | PF-E3-T1-S2; PF-E4-T1-S2 |
| [x] | 4. Unassignment | PF-E3-T1-S2; PF-E4-T1-S2 |
| [x] | 5. Assignee activity history / atomicity | PF-E3-T1-S1; PF-E4-T1-S1; PF-E4-T1-S2 |
| [x] | 6. Activity API | PF-E4-T2-S1; PF-E4-T2-S2 |
| [x] | 7. Activity pagination | PF-E4-T2-S1; PF-E4-T2-S2; PF-E5-T1-S2; PF-E6-T1-S1 |
| [x] | 8. Activity authorization | PF-E4-T2-S1; PF-E4-T2-S2 |
| [x] | 9. Activity performance / N+1 | PF-E4-T2-S1; PF-E6-T1-S1; PF-E6-T1-S2 |
| [x] | 10. Activity indexes | PF-E4-T2-S1; PF-E4-T2-S2 |
| [x] | 11. Frontend selector | PF-E5-T1-S1; PF-E5-T1-S2 |
| [x] | 12. Frontend update strategy | PF-E5-T1-S1; PF-E5-T1-S2 |
| [x] | 13. Activity timeline | PF-E5-T1-S2 |
| [x] | 14. Production authorization bug | PF-E1-T1-S2; PF-E1-T2-S1; PF-E1-T2-S2 |
| [x] | 15. Concurrent task creation | PF-E2-T1-S1; PF-E2-T1-S2 |
| [x] | 16. Automated tests | PF-E1-T2-S2; PF-E2-T1-S2; PF-E4-T1-S2; PF-E4-T2-S2; PF-E6-T1-S3 |
| [x] | 17. Code review | PF-E7-T1-S1 |
| [x] | 18. Scaling discussion | PF-E7-T1-S1 |
| [x] | 19. README / developer experience | PF-E7-T1-S1; PF-E7-T1-S2 |
| [x] | 20. Assessment notes / final reflection: exact `## If I Had Two More Days` | PF-E7-T1-S1 |
| [x] | 21. Bug report | PF-E1-T1-S2; PF-E7-T1-S1 |
| [x] | 22. AI log | PF-E7-T1-S1 |
| [x] | 23. Git history | PF-E1-T1-S1; PF-E1-T2-S1; PF-E1-T2-S2; PF-E2-T1-S1; PF-E3-T1-S2; PF-E4-T1-S1; PF-E7-T1-S2 |
| [x] | 24. Final verification / submission | PF-E6-T1-S3; PF-E7-T1-S2 |

### Explicit Coverage Conclusions

All 24 numbered requirements were checked against the approved plan's Requirement, Required Change, acceptance behavior and test priorities, then against the CSV descriptions/acceptance criteria. The matrix maps concrete work, not merely labels. No requirement was dropped in Revision 2.

- Authorization reproduction/fix and preserved PATCH/DELETE policies: PF-E1-T1-S2 and PF-E1-T2-S1/S2.
- Concurrent numbering and dedicated parallel tests: PF-E2-T1-S1/S2.
- Assignment permissions, explicit project membership, 403/400 semantics, null/omission and unassignment/no-op behavior: PF-E3-T1-S2 and PF-E4-T1-S2.
- Activity consistency, topology gate and failure atomicity: PF-E3-T1-S1 and PF-E4-T1-S1/S2.
- Activity authorization, pagination/order, batched enrichment/N+1 prevention, missing-user fallback and appropriate indexes: PF-E4-T2-S1/S2; recommended assertions in PF-E6-T1-S1.
- Selector, timeline and server-confirmed behavior: PF-E5-T1-S1/S2, with integrated verification in PF-E6-T1-S3.
- Required tests: implementation-local test issues plus mandatory integrated/full-suite review PF-E6-T1-S3.
- Code review, scaling discussion, README, AI_LOG, ASSESSMENT_NOTES ending in exact `## If I Had Two More Days`, and BUG_REPORT: PF-E7-T1-S1.
- Git history and exact messages: implementation guidance above and final history check PF-E7-T1-S2.
- Final verification/submission: PF-E6-T1-S3 and PF-E7-T1-S2, with documentation preparation PF-E7-T1-S1 kept separate.

Required behavior remains required even if a strongly recommended automated variant is deferred. This is a coverage audit of the execution breakdown, not evidence that application requirements have already been implemented.

## 11. Import Safety Checklist

Checks concern the revised artifacts only. Jira mapping still needs target-instance configuration as described above.

- [x] Hierarchy preserved: same 7 Epics and 9 Tasks; all old IDs/parents retained; one new mandatory quality Sub-task.
- [x] Parent references valid: Task → Epic, Sub-task → Task; Epics have no parent.
- [x] No orphan issues.
- [x] Dependency references valid: executable Sub-tasks only, no self-links/cycles, no redundant transitive edges.
- [x] No duplicate Issue IDs.
- [x] No missing requirements: complete matrix for approved plan 1–24.
- [x] Estimates within assessment cap: mandatory 285m, recommended 5m, optional 5m; total 295m before applicable prior effort; critical path 130m with independent-branch overlap.
- [x] All Epic/roll-up Task Original Estimates are 0m; all Actual Time values are 0m.
- [x] Final gate transitively includes every mandatory implementation/testing issue and directly requires documentation.
- [x] Optional/recommended checks do not block final readiness.
- [x] No source code changes; approved IMPLEMENTATION_PLAN.md unchanged.
- [x] No dependencies installed, no final assessment deliverables created, no Jira import/submission performed.
- [x] No commits.
