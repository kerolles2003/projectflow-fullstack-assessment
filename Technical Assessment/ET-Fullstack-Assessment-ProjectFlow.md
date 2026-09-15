T E C H N I C A L A S S E S S M E N T · V 1 . 0 



Digital Products Company 

Candidate Brief · ProjectFlow 



Full-Stack Software Engineer 

Eng Techno | Kafr El Sheikh, Egypt Version: 1.0 · Date: 9 September 2026 · Expected effort: 4 hours, hard cap 6 hours 

Full-Stack Engineer · Technical Assessment 



## Agenda 

Nine parts, one repository. Read the whole brief before you start writing code — the ordering below is how the work is evaluated, not necessarily the order you should tackle it in. 

Part One — Understand the system Part Four — Frontend Part Two — Task assignment implementation Part Three — Activity history Part Five — Production bug Part Six — Concurrent task creation 

Part Seven — Testing Part Eight — Code review exercise Part Nine — Scaling question 

Deliverables: source code, `README.md` , `ASSESSMENT_NOTES.md` , `BUG_REPORT.md` , `AI_LOG.md` , automated tests, schema changes. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

2 / 32 

P A R T O N E 

# Before You Start 

What ProjectFlow already is, how much time to spend on it, and which technical choices are already made for you. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

3 / 32 

Full-Stack Engineer · Technical Assessment 



## 0 1 The Assessment 

You will receive an existing full-stack application called ProjectFlow — a lightweight project-management platform where organizations manage projects, members, tasks and comments. Treat the repository as a production codebase you have recently joined. Start from github.com/engtechno/Full-Stack-Assessment-Task. 

ALREADY BUILT 

YOUR SCOPE 

### What exists today 

What you are expected to do 

- Authentication, users and organizations 

   - Understand the existing architecture 

- Projects and project members 

   - Implement the requested feature 

- Tasks, comments and basic task management 

   - Investigate a reported production issue 

   - Fix a concurrency problem, write tests 

   - Review a provided implementation, document decisions 

- Not in scope: rebuilding the application. We are measuring how you extend a system you did not write. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

4 / 32 

Full-Stack Engineer · Technical Assessment 



## 0 2 Time and Prioritization 

Expected effort Hard cap Scope provided 4 hours 6 hours Deliberately larger 

The scope intentionally contains more opportunities for improvement than you will have time to address. Deciding what to leave alone is part of the assessment. 

What should be implemented? What deserves testing? What should be improved? What should be documented as future work? What should be left unchanged? Bottom line: we value good prioritization over attempting to perfect everything. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

5 / 32 

Full-Stack Engineer · Technical Assessment 



## 0 3 Technology 

Use the technology and architecture already provided in the repository. Follow the existing patterns unless you have a strong reason not to. 

- Additional libraries are allowed when they solve a real problem — but avoid unnecessary dependencies. 

- Major architectural rewrites are not wanted. Extending the system consistently scores higher than replacing parts of it. 

- Justify anything significant. If you introduce a notable dependency or change the architecture, explain why in your notes. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

6 / 32 

P A R T T W O 

# The Work 

One feature to build end to end, two production issues to investigate and fix, a test suite to extend, a pull request to review, and a scaling question to answer. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

7 / 32 

Full-Stack Engineer · Technical Assessment 



## 0 4 Understand the Existing System 

Create `ASSESSMENT_NOTES.md` and document your understanding. We are interested in the overall system, not every file. 

ARCHITECTURE 

OBSERVATIONS 

### Questions to answer 

At least three risks or weaknesses 

- How is the application structured, and what are the major modules? 

What you noticed 

Why it could be a problem 

Where does business logic live? 

Whether you would fix it now or later 

- How does the frontend talk to the backend, and how is server state handled? 

- Why 

You are not required to fix all of them. 

- How are authentication and authorization implemented? 

- How are the main entities related? 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

8 / 32 

Full-Stack Engineer · Technical Assessment 



## 0 5 Task Assignment 

Product has requested the ability to assign project members to tasks. A task should support an assignee. 

|Concept|Notes|
|---|---|
|assignee|The project member who owns the task. Nullable.|
|createdBy|Already exists — do not conflate the two.|
|project|Scopes who may be assigned at all.|
|status, priority|Existing fields, unchanged.|
|Adapt, do not tra|nsplant.Fit the assignee into the existing data model rather than reproducing a generic task shape.|



Eng Techno · engtechnos.com · +201125962610 · +971522129096 

9 / 32 

Full-Stack Engineer · Technical Assessment 



## 0 6 Assignment Business Rules 

RULE #1 

### Project membership 

Only members of the project may be assigned to tasks belonging to that project. 

Enforced by the backend. Frontend validation alone is not enough. 

RULE #2 

### Assignment permissions 

`OWNER` , `ADMIN` and `PROJECT_MANAGER` may 

assign other project members. 

A regular member may assign a task to themselves, but not to anyone else. 

RULE #3 

### Unassignment 

An authorized user may remove the current assignee, and the activity history must represent that change appropriately. 

Unauthorized attempts return an appropriate API error. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

10 / 32 

Full-Stack Engineer · Technical Assessment 



## 0 7 Task Activity History 

Maintain an activity history for important task changes. For this assessment, track assignee changes only: when a task’s assignee changes, an activity record is created. 

```
{
  "type":     "TASK_ASSIGNEE_CHANGED",
  "actor":    "USER_ID",
  "task":     "TASK_ID",
  "metadata": { "from": "PREVIOUS_ASSIGNEE_ID", "to": "NEW_ASSIGNEE_ID" },
  "createdAt": "..."
}
```

Your design must handle all three transitions: 

Unassigned → Assigned Assigned → Different user 

Assigned → Unassigned 

The exact schema is yours to design, in keeping with the existing architecture and database. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

11 / 32 

Full-Stack Engineer · Technical Assessment 



## 0 8 Activity API 

Create an endpoint for retrieving task activity, for example `GET /tasks/:taskId/activity` . The response contains paginated activity records. The structure may differ if the project already follows another convention. 

Paginated. Results must page; newest activity first. 

- Authorized. Access control is enforced on the endpoint. 

- No obvious N+1. Resolving actors must not cost one query per record. 

- Indexed. Consider what the database needs to serve this query. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

12 / 32 

Full-Stack Engineer · Technical Assessment 



## 0 9 Frontend — Assignee Selector 

Update the existing task details interface to support assignment. Add an assignee selector that displays project members and is searchable when appropriate. 

Loading states Disabled states Responsive behavior Empty states Permission handling Basic accessibility Error states TypeScript typing Correct update after change Server state: optimistic updates with rollback, or another well-designed strategy. Explain significant decisions. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

13 / 32 

Full-Stack Engineer · Technical Assessment 



## 1 0 Activity Timeline UI 

Add an activity section to the task details interface, reading as plain history rather than raw records. 

```
Activity
  Ammar assigned Magd                                    2 minutes ago
  Magd changed the assignee from themselves to Ahmed    25 minutes ago
  Ahmed removed the assignee                                1 hour ago
```

Do not redesign the application. The section should integrate with the existing visual language. We are measuring your ability to extend a product consistently. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

14 / 32 

Full-Stack Engineer · Technical Assessment 



## 1 1 Production Bug Investigation 

Reported by support: “Some users appear to be able to modify tasks belonging to projects they are not members of.” 

Investigate and determine whether the issue exists. If you reproduce it: identify the root cause, fix it, and add regression tests. Document everything in `BUG_REPORT.md` . 

Root Cause — what caused it Reproduction — how you verified it Impact — what an unauthorized user Fix — what you changed could do 

Regression Prevention — what stops it returning Or: how you concluded it does not exist 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

15 / 32 

Full-Stack Engineer · Technical Assessment 



## 1 2 Concurrent Task Creation 

Tasks carry a sequential, project-specific identifier — `ENG-101` , `ENG-102` , `ENG-103` . Occasionally two tasks created at approximately the same time receive the same number. 

```
const count = await Task.countDocuments({ projectId });
const nextNumber = count + 1;
```

- Investigate and fix. The solution must stay correct when multiple application requests create tasks concurrently. 

- Document the decision. Explain any important database or architectural choice your solution depends on. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

16 / 32 

Full-Stack Engineer · Technical Assessment 



## 1 3 Testing 

Add meaningful automated tests for your implementation. At minimum, cover the important business rules. 

- A project member can assign themselves 

- An authorized project role can assign another project member 

- A regular member cannot assign another user 

   - Changing an assignee creates an activity record Unassigning a task creates the appropriate activity Unauthorized users cannot modify another project’s tasks 

- A user outside the project cannot be assigned 

   - Concurrent creation cannot duplicate a task identifier 

- Unauthorized users cannot access task activity 

Not a coverage target. We care about what you chose to test, and why. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

17 / 32 

Full-Stack Engineer · Technical Assessment 



## 1 4 Code Review Exercise 

Assume another engineer submitted this implementation. Review it as a pull request in an `ASSESSMENT_NOTES.md` section called 

`## Code Review` . 

```
async assignTask(taskId: string, assigneeId: string, userId: string) {
  const task = await this.taskModel.findById(taskId);
  if (!task) { throw new NotFoundException(); }
  const user = await this.userModel.findById(assigneeId);
  if (!user) { throw new NotFoundException(); }
  task.assignee = user._id;
  await task.save();
  return task;
}
```

Consider correctness, security, authorization, business rules, data consistency, maintainability, error handling, performance and architecture. Explain what you would ask the engineer to change and why — do not rewrite the function for its own sake. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

18 / 32 

Full-Stack Engineer · Technical Assessment 



## 1 5 Scaling the Activity System 

Assume ProjectFlow grows from roughly 5,000 users to 500,000, and task activity becomes one of the largest datasets in the system. Explain how you would evolve your implementation — one to two pages, no more. 

Database indexes Data growth and retention Background jobs and queues Cursor vs offset pagination Archiving Real-time updates Query patterns Asynchronous processing Caching and observability Not a technology parade. Explain what you would change, when you would change it, and why. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

19 / 32 

P A R T T H R E E 

# Working Practices 

How you use AI tools, how you use Git, and what another engineer needs in order to run your work without asking you. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

20 / 32 

Full-Stack Engineer · Technical Assessment 



## 1 6 AI Usage Policy 

AI tools are explicitly allowed — Claude Code, Codex, ChatGPT, Copilot, Cursor, Gemini, any coding assistant. Using them will not count against you. Using modern engineering tools well is normal software development. 

The trade: you are fully responsible for every line of code and every technical decision in your submission. 

You should be able to explain, in the technical interview: 

How your implementation works Why your database solution is safe Why you chose your architecture How authorization works 

What your tests protect What you accepted or rejected 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

21 / 32 

Full-Stack Engineer · Technical Assessment 



## 1 7 AI Usage Documentation 

Create `AI_LOG.md` . We do not want your full conversation history — four short sections are enough. If you did not use AI, simply say so. 

01 

02 

Tools used 

### How you used them 

Which assistants, briefly. 

Exploration, planning, test generation, debugging, review, concurrency discussion. 

03 

04 

### Suggestions you rejected 

### Generated code you modified 

At least one you disagreed with or significantly changed, and why. 

What it produced, what was insufficient, what you changed, why. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

22 / 32 

Full-Stack Engineer · Technical Assessment 



## 1 8 Git Practices 

Treat the assessment as normal professional development work. We are interested in how your implementation evolved, so avoid a single `final` commit unless there is a specific reason. 

```
feat: add task assignment domain logic
feat: implement task activity history
fix:  enforce project membership on task mutations
fix:  make project task numbering concurrency-safe
test: add task authorization regression coverage
```

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

23 / 32 

Full-Stack Engineer · Technical Assessment 



## 1 9 README 

Update or create `README.md` with enough information for another engineer to run and evaluate your work. 

- Setup — how to install dependencies 

Tests — how to run the suite 

- Environment — required variables, no real secrets 

Database — how to initialize and run it 

Technical Decisions — the major ones Known Limitations — what you left out 

- Running — backend and frontend 

Provide a `.env.example` where appropriate. Never commit real credentials. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

24 / 32 

Full-Stack Engineer · Technical Assessment 



## 2 0 Developer Experience 

We should be able to clone your repository and run the application without reverse-engineering your environment. 

Docker is welcome, not required. A `docker compose up` setup is fine where it fits, but only mandatory if the starter repository already requires it. 

Whatever approach you take must be clearly documented and reproducible on a clean machine. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

25 / 32 

P A R T F O U R 

# Evaluation and Submission 

What we actually assess, the judgment we expect you to exercise, and everything the final submission has to contain. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

26 / 32 

Full-Stack Engineer · Technical Assessment 



## 2 1 What We Evaluate 

The assessment measures more than whether the feature works. 

Understanding an unfamiliar codebase 

Requirement interpretation Backend engineering Frontend engineering Database design 

Security and authorization Data consistency Concurrency handling API design TypeScript usage 

Testing strategy Debugging ability Code organization Git practices and documentation Recognizing unnecessary complexity 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

27 / 32 

Full-Stack Engineer · Technical Assessment 



## 2 2 Judgment and Restraint 

AMBIGUITY 

COMPLEXITY 

You are allowed to decide 

### Avoid overengineering 

Some requirements are deliberately unspecified. Engineers work with requirements that need judgment. 

Make a reasonable assumption 

Architectural improvements are welcome when they solve a real problem. Adding technology to look sophisticated is not. 

Document the assumption 

You do not automatically need Kafka, RabbitMQ, Redis, microservices, CQRS, event sourcing or Kubernetes. 

Continue — do not block on minor ambiguity 

The question we will ask: what concrete problem does this solve in the current system? 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

28 / 32 

Full-Stack Engineer · Technical Assessment 



## 2 3 Final Reflection 

End `ASSESSMENT_NOTES.md` with a section called `## If I Had Two More Days` . 

Explain what you would improve given two additional working days. 

- Prioritize it. The ordering is the point. 

- Why we ask: what you consider most important after finishing tells us more than the implementation alone. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

29 / 32 

Full-Stack Engineer · Technical Assessment 



## 2 4 Submission Checklist 

INCLUDE 

### Your submission contains 

Application source code 

```
README.md
```

```
ASSESSMENT_NOTES.md
```

```
BUG_REPORT.md
```

```
AI_LOG.md
```

Automated tests 

Database / schema changes 

VERIFY 

### Before you submit 

The application starts successfully 

The requested feature works 

Tests run successfully 

Schema changes are included No credentials or secrets committed 

Documentation is complete 

You can explain your implementation 

- `.env.example` where applicable 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

30 / 32 

Full-Stack Engineer · Technical Assessment 



<!-- Start of picture text -->
-<br>=<br>=<br><!-- End of picture text -->

## 2 5 How to Submit 

WHERE 

### The careers portal 

Submit at engtechnos.com/en/careers/submit-task. 

- Email Address * — the address you applied with 

- Job Position * — select the role you applied for 

- GitHub Repository URL — your repository, built on the starter repo 

- Live Demo URL — optional, and it counts in your favour 

- Deliverable Files — up to 5, ZIP/PDF/PNG/JPG, 10MB each 

- Additional Notes — put your approximate time spent here 

Hosting costs money, so a deployment is never required and skipping it costs you nothing. A working live URL is a genuine advantage. Never include passwords or production credentials. 

THE FORM 

### What you will see 



<!-- Start of picture text -->
Email Address * Job Position *<br>e.g. john@example.com Full-Stack Developer Intern .<br>GitHub Repository URL Live Demo URL<br>5 htipsiigithub.comfusernamalrpo Retest projectveoel ape<br>Deliverable Files (You can upload up to5 files)<br>><br>Drag & drop your file here,or click to browse<br>Additional Notes<br><!-- End of picture text -->

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

31 / 32 

Full-Stack Engineer · Technical Assessment 



## 2 6 Final Note 

There is no single expected implementation. Different engineering decisions may all be valid when they are technically sound and appropriately justified. 

What we are primarily interested in: understand → reason → implement → verify → communicate — rather than simply producing the largest amount of code. 

Good luck. 

Eng Techno · engtechnos.com · +201125962610 · +971522129096 

32 / 32 

