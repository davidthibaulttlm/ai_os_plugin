# OPSX: Apply

Implement tasks from an OpenSpec change (Experimental)

Implement tasks from an OpenSpec change.

**Input**: Optionally specify a change name (e.g., `/opsx:apply add-auth`). If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `openspec list --json` to get available changes and use the **AskUserQuestion tool** to let the user select

   Always announce: "Using change: <name>" and how to override (e.g., `/opsx:apply <other>`).

2. **Check status to understand the schema**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to understand:
   - `schemaName`: The workflow being used (e.g., "spec-driven")
   - `planningHome`, `changeRoot`, and `actionContext`: planning scope and edit constraints
   - Which artifact contains the tasks (typically "tasks" for spec-driven, check status for others)

3. **Get apply instructions**

   ```bash
   openspec instructions apply --change "<name>" --json
   ```

   This returns:
   - `contextFiles`: artifact ID -> array of concrete file paths (varies by schema)
   - Progress (total, complete, remaining)
   - Task list with status
   - Dynamic instruction based on current state

   **Handle states:**
   - If `state: "blocked"` (missing artifacts): show message, suggest using `/opsx:continue`
   - If `state: "all_done"`: congratulate, suggest archive
   - Otherwise: proceed to implementation

   **Workspace guard:** If status JSON reports `actionContext.mode: "workspace-planning"` and `allowedEditRoots` is empty, explain that full workspace apply is not supported in this slice. Treat linked repos and folders as read-only context, ask the user to select an affected area through an explicit implementation workflow, and STOP before editing files.

4. **Read context files**

   Read every file path listed under `contextFiles` from the apply instructions output.
   The files depend on the schema being used:
   - **spec-driven**: proposal, specs, design, tasks
   - Other schemas: follow the contextFiles from CLI output

5. **Show current progress**

   Display:
   - Schema being used
   - Progress: "N/M tasks complete"
   - Remaining tasks overview
   - Dynamic instruction from CLI

6. **MANDATORY: Logger in Every File (Before Implementing Any Task)**

    **Before writing ANY code, remember the rules from AGENTS.md:**
    - **EVERY method in EVERY file MUST log with `logger` from `src/services/logger.ts`**
    - **ALWAYS import `logger`** at the top of every file: `import { logger } from './services/logger';`
    - **ALWAYS log at the START of every method**: `logger.info('[ClassName.methodName] Starting...')`
    - **ALWAYS log key parameters**: `logger.info('[ClassName.methodName] param=value')`
    - **ALWAYS log results**: `logger.info('[ClassName.methodName] Result: ...')`
    - **ALWAYS log errors**: `logger.error('[ClassName.methodName] Error: ...')`
    - **NEVER use `console.log`** — use `logger` exclusively
    - This applies to 100% of files without exception

    **EVERY new method MUST follow this exact pattern:**

    ```typescript
    import { logger } from '../services/logger';  // adjust relative path

    export class SomeService {
      public async someMethod(param1: string, param2: number): Promise<ResultType> {
        logger.info('[SomeService.someMethod] Starting...');
        logger.info(`[SomeService.someMethod] param1=${param1}, param2=${param2}`);

        try {
          // ... implementation ...
          const result = /* ... */;

          logger.info(`[SomeService.someMethod] Result: ${JSON.stringify(result)}`);
          return result;
        } catch (error) {
          logger.error(`[SomeService.someMethod] Error: ${(error as Error).message}`);
          throw error;
        }
      }

      public someSyncMethod(value: string): boolean {
        logger.info('[SomeService.someSyncMethod] Starting...');
        logger.info(`[SomeService.someSyncMethod] value=${value}`);

        try {
          // ... implementation ...
          const ok = /* ... */;

          logger.info(`[SomeService.someSyncMethod] Result: ${ok}`);
          return ok;
        } catch (error) {
          logger.error(`[SomeService.someSyncMethod] Error: ${(error as Error).message}`);
          throw error;
        }
      }
    }
    ```

    **Verification checklist before marking any task complete:**
    - [ ] `import { logger }` present at top of file
    - [ ] Every method has `logger.info('[Class.method] Starting...')` as first line
    - [ ] Every method logs parameters
    - [ ] Every method logs result/return value
    - [ ] Every method has try/catch with `logger.error()`
    - [ ] Zero `console.log` in the file (run: `grep -n "console\\.log" src/path/file.ts`)

    If the tasks.md does not have a logging task group, ADD one before starting implementation.

7. **Implement tasks (loop until done or blocked)**

    For each pending task:
    - Show which task is being worked on
    - Make the code changes required
    - Keep changes minimal and focused
    - **Ensure every new method has logger import + start/params/result/error logging**
    - Mark task complete in the tasks file: `- [ ]` → `- [x]`
    - Continue to next task

   **Pause if:**
   - Task is unclear → ask for clarification
   - Implementation reveals a design issue → suggest updating artifacts
   - Error or blocker encountered → report and wait for guidance
   - User interrupts

7. **On completion or pause, show status**

   Display:
   - Tasks completed this session
   - Overall progress: "N/M tasks complete"
   - If all done: suggest archive
   - If paused: explain why and wait for guidance

**Output During Implementation**

```
## Implementing: <change-name> (schema: <schema-name>)

Working on task 3/7: <task description>
[...implementation happening...]
✓ Task complete

Working on task 4/7: <task description>
[...implementation happening...]
✓ Task complete
```

**Output On Completion**

```
## Implementation Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 7/7 tasks complete ✓

### Completed This Session
- [x] Task 1
- [x] Task 2
...

All tasks complete! You can archive this change with `/opsx:archive`.
```

**Output On Pause (Issue Encountered)**

```
## Implementation Paused

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 4/7 tasks complete

### Issue Encountered
<description of the issue>

**Options:**
1. <option 1>
2. <option 2>
3. Other approach

What would you like to do?
```

**Guardrails**
- Keep going through tasks until done or blocked
- Always read context files before starting (from the apply instructions output)
- If task is ambiguous, pause and ask before implementing
- If implementation reveals issues, pause and suggest artifact updates
- Keep code changes minimal and scoped to each task
- Update task checkbox immediately after completing each task
- Pause on errors, blockers, or unclear requirements - don't guess
- Use contextFiles from CLI output, don't assume specific file names

**Fluid Workflow Integration**

This skill supports the "actions on a change" model:

- **Can be invoked anytime**: Before all artifacts are done (if tasks exist), after partial implementation, interleaved with other actions
- **Allows artifact updates**: If implementation reveals design issues, suggest updating artifacts - not phase-locked, work fluidly

**Mandatory Testing During Implementation**

After implementing all functional tasks, tests MUST be written before marking the change complete:

1. **ONE TEST FILE PER METHOD** — Each method gets its own test file. NEVER clump multiple methods into a single test file.
   - Naming: `src/test/services/<service>.<method>.test.ts` (e.g., `agent.selectNextIssue.test.ts`)
   - Constants/static methods: `src/test/services/<service>.constants.test.ts` or `<service>.<staticMethod>.test.ts`
   - **MAX 400 LINES per test file** — if a test file exceeds 400 lines, split it further

2. **Write unit tests** for every new/modified service file using Vitest
   - Mock `vscode` API with `vi.mock('vscode', ...)`
   - Mock `GraphQLClient` with `vi.fn()` spies
   - Place tests in `src/test/services/*.test.ts`

3. **Update Storybook stories** for every new/modified webview component
   - Add isolated rendering stories for new props/states
   - Add interaction tests with `@storybook/test` and `userEvent`

4. **Write integration tests** for new command flows
   - Place in `src/test/integration/*.integration.test.ts`

5. **Verify coverage**: Run `npx vitest run --coverage` — must achieve ≥90% on all new/modified files

6. **Do NOT mark change complete** until all tests pass and coverage threshold met

If the tasks.md lacks a testing task group, create one and work through it before finishing.
