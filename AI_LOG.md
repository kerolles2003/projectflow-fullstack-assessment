# AI Usage Log

## 1. Tools Used

I used OpenAI Codex for repository exploration, implementation assistance, review and documentation. Its terminal/file tools supported source inspection and execution of existing checks. I am responsible for reviewing the resulting code and explaining the decisions; tool output alone is not proof that a requirement is satisfied.

## 2. How I Used Them

I used assistance to map the existing architecture, plan bounded Jira work, investigate the status authorization path, reason about atomic project numbering and assignment/history transactions, extend the existing tests, implement the selector/timeline, diagnose local MongoDB startup issues, and audit requirements and documentation. Work proceeded through scoped implementation and review steps. Real test results, source reads and Git state were checked rather than relying only on generated explanations. Browser smoke success was candidate-reported, not an automated browser result.

## 3. AI Suggestions / Decisions

During the assisted analysis and implementation, the following approaches were selected and retained in the implementation. This records the outcome, not a claim that AI originated each decision:

- Authorize against the loaded task's stored `projectId`, not caller-supplied project context.
- Replace `countDocuments() + 1` with atomic project-scoped `lastTaskNumber` allocation and compound uniqueness.
- Persist assignment and its separate activity record in one MongoDB transaction/session.
- Keep frontend assignment server-confirmed, using returned TaskDetail and refetching after uncertain failures.
- Use explicit Load more for server-paginated activity, preserving server order and stable event IDs.

These choices are reflected in TasksService, the task/project/activity schemas, frontend task hooks and TaskActivityTimeline. They followed the scoped implementation and review workflow rather than introducing a new architecture.

## Suggestions I Rejected

No specific rejected AI suggestion is recorded because the conversational history was not preserved as a repository artifact. I have intentionally not reconstructed a rejected suggestion from an unchosen alternative.

The candidate retained final responsibility for narrowing scope, rejecting unsupported claims, and deciding which implementation options were appropriate for the assessment.

## Generated Code I Modified

During the assisted E5 selector implementation, the initial generated Retry button used `variant="outline"`. TypeScript rejected it because the existing Button supports primary, secondary, ghost and danger. It was corrected to `variant="secondary"`, reusing the existing component API instead of extending the design system. The final `TaskAssigneeSelect` and Button primitive reflect that correction, and subsequent typecheck/lint/build passed. The correction was made during the assisted workflow; this is not a claim that I independently hand-edited it outside that workflow.

During E6 review, the existing self-assignment test was strengthened with project/task creation, forbidden-mutation persistence checks and refreshed task/history assertions; an existing history test gained an actual index assertion. Earlier checks proved individual operations but did not cover that combined refresh path. These focused changes reused the existing harness and passed in the 50-test full run. They are now committed in `8a08ab8`, the current implementation HEAD. They were assisted verification refinements, not a new test framework.

## 4. Verification of AI-Generated Work

**Automated verification:** The latest fresh root `pnpm test --force` run passed four suites and 50 tests, with zero failed/skipped, in 101.848 seconds of Jest time. It used the existing MongoMemoryReplSet global setup/teardown and a real disposable transaction-capable MongoDB replica set. Tests exercised authorization denial with unchanged database state, assignment/history rollback, parallel numbering, project isolation and actual MongoDB index assertions. API and frontend TypeScript checks, lint and builds passed. Broader formatting checks had existing failures; they were not reported as universally green.

**AI/agent execution:** The agent inspected source/diffs, ran terminal checks and examined runtime/database results. Earlier verification used disposable Docker MongoDB; final E6 used the native replica-set fixture. Recorded results, rather than agent assertions of correctness, supplied the evidence. Root `pnpm dev` was also executed in Windows Git Bash: web ports 3742 and 3800 both returned HTTP 200, and the API started on 4732. The Node launcher and Turbo environment allowance are committed in `08d5ad5`; no dependency was added. No new test run was performed for this log revision. Production was not accessed or verified.

**Candidate review:** I directed scope and review gates and reviewed the resulting work. Browser smoke testing was manually performed by the candidate and was not an automated browser verification performed by AI. That browser result is candidate-reported; no automated browser run or screenshots are claimed as evidence here.

## 5. Human Responsibility

My responsibilities are to review generated code and documentation against the brief; check stored-project authorization boundaries and assignment business rules; inspect persistence, transaction rollback, concurrency and index evidence; run or inspect test commands and their results; and decide what belongs in scope. Where commands were executed by the agent, I must understand what they establish and what remains unverified rather than imply I independently reran them. I still need to supply actual elapsed time before submission. No specific rejected suggestion is reconstructed without evidence.

## 6. Representative Prompts

Exact conversational prompts were not preserved as repository artifacts; this log summarizes the documented AI-assisted workflow rather than reconstructing prompts from memory.

## 7. Final Assessment of AI Use

AI accelerated repository exploration, implementation assistance, testing refinement and documentation. I reviewed the resulting work through scoped review gates and verification evidence; output was not accepted solely because the agent claimed it was correct. Automated checks and runtime/database observations were used where applicable, while candidate-reported browser results and unverified production infrastructure remained explicitly distinguished.
