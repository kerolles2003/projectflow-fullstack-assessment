# Jira Import Compatibility Report

## Verdict

**Documented format validation: PASS. Live Jira validation: PENDING.**

Source: `projectflow-assessment-final.csv`  
Output: `projectflow-assessment-jira-import.csv`

The output targets Jira Cloud's **administrator External System Import, old experience, into a company-managed project**. The supplied rejection does not identify the current wizard or project type. No live Jira import was performed; this report does not certify acceptance by that unidentified wizard.

## 1. Why the previous CSV failed

Jira reported 16 acceptable issues and 19 rejected Sub-tasks because no parent issue key or ID was supplied to its hierarchy handler. The source CSV contains parent numbers for all 19 Sub-tasks, so missing CSV values were not the problem. Jira did not recognize those values as parent relationships.

The exact configuration failure cannot be established without the rejected import's field mapping. A column named `Parent Import ID` does not create hierarchy by itself; mapping it to a custom text field also does not establish a parent. The earlier local validation report verified file consistency, not Jira acceptance.

## 2. Supported solution

Atlassian documents same-file numeric placeholder IDs with the built-in Parent field for company-managed Jira Cloud imports, including Epic → standard issue → Sub-task. Actual Jira keys are not needed before creation. The new file uses `Issue ID` and `Parent` headers and puts all Epics first, then Tasks, then Sub-tasks. The numeric values are unchanged. [Atlassian hierarchy import guidance](https://support.atlassian.com/jira/kb/keep-issue-parent-child-mapping-during-csv-import-to-jira-cloud/)

Example from the output:

| Stable Issue ID | Issue ID | Parent |
|---|---:|---:|
| PF-E1 | 1 | |
| PF-E1-T1 | 8 | 1 |
| PF-E1-T1-S1 | 9 | 8 |

**The solution requires the native mappings below; renaming CSV headers alone is insufficient.** PF identifiers remain stable informational identifiers, not invented Jira issue keys.

## 3. Import route and exact mapping

Use Jira administrator **Settings → System → External system import → Switch to old experience → CSV**. Select the intended company-managed destination with Epic, Task and Sub-task enabled. Use a fresh mapping rather than the rejected configuration. [Atlassian hierarchy import procedure](https://support.atlassian.com/jira/kb/keep-issue-parent-child-mapping-during-csv-import-to-jira-cloud/)

| CSV column | Jira destination |
|---|---|
| Issue ID | **Issue ID / Work item ID**, the native import identifier |
| Parent | **Parent**, the built-in hierarchy relationship |
| Stable Issue ID | Don't map; retained in the CSV. Map only if an existing suitable custom field is confirmed. |
| Issue Type | Issue Type / Work Type; map Epic → Epic, Task → Task, Sub-task → Sub-task |
| Summary | Summary |
| Description | Description |
| Priority | Priority; High → High, Medium → Medium, Low → Low |
| Status | Status; To Do → To Do |
| Labels (first occurrence) | Labels |
| Labels (second occurrence) | Labels |
| Original Estimate | Original Estimate, interpreted as seconds |

Do not map Issue ID to Issue Key or a custom field. Do not map Parent to a custom text field. There is no Actual Time column or issue-link mapping.

Duplicate Labels columns supply separate labels; numeric estimates use seconds. The administrator CSV documentation describes native identity/parent mappings and multivalue fields. [Atlassian CSV import documentation](https://support.atlassian.com/jira-cloud-administration/docs/import-data-from-a-csv-file/)

**If native Issue ID and Parent are unavailable, stop in that wizard.** This file must be used through the documented administrator route; a custom field is not a substitute. The available evidence does not establish support for another importer or a team-managed destination.

## 4. One import versus two stages

**One import is sufficient for the documented route above**, using same-file numeric placeholders. A two-stage import is therefore not required; step 1 / step 2 are not applicable.

If that route cannot be accessed, the exact alternative importer and its native parent capabilities must be established before generating any staged files. No speculative second-stage CSV or unknown actual Jira parent keys have been invented.

The reported “will be created” message describes validation, not proof that 16 issues were created. If a partial import was subsequently executed, reconcile its actual Jira keys before reusing this creation CSV to avoid duplicates.

## 5. Programmatic validation

Validation reparsed the saved CSV, compared rows by Stable Issue ID with the source, and checked hierarchy references and ordering.

| Check | Result |
|---|---|
| Epics | 7 |
| Tasks | 9 |
| Sub-tasks | 19 |
| Total issues | 35 |
| Unique numeric Issue IDs | 35; PASS |
| Stable Issue IDs | Every source identifier preserved exactly once |
| Parent references | All 28 resolve to an existing earlier row |
| Epic parents | All blank |
| Task parents | All reference the original Epic |
| Sub-task parents | All 19 reference the original Task |
| Orphans / hierarchy changes | None |
| Original Estimate | Numeric seconds only, unchanged for every issue |
| Executable estimate | 17,700 seconds = 295 minutes |
| Scope, types, priorities, status | Unchanged; status remains To Do |
| Descriptions | Full parsed values identical to source |
| Acceptance criteria / requirements / dependencies / phase | All labeled Description sections preserved without changes |
| Labels | Both separate label values unchanged |
| Dependencies | Informational text unchanged; no issue links generated |
| Source CSV / approved plan / application source | Unchanged |
| Commits | None created |

Only the two hierarchy headers and row ordering changed. No description, requirement, acceptance criterion, dependency, estimate or planned work was edited.

## 6. Live acceptance gate

Before proceeding in Jira, verify the native mappings above and require **35 accepted issues, zero rejected issues**. The previous result of 16 accepted issues is insufficient. After import, verify all nine Task-to-Epic and all nineteen Sub-task-to-Task relationships against this file; row creation alone does not prove hierarchy attachment.

The artifact passes local structural and preservation checks against the documented format. **Successful import into the user's Jira remains unverified.**

