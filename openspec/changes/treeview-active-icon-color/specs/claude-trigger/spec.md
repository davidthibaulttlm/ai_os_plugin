## MODIFIED Requirements

### Requirement: Claude trigger always auto-works without any restrictions
The Claude trigger SHALL always auto-work on eligible issues entering trigger columns. It SHALL NOT check `autoWorkAssignments`, SHALL NOT show a confirmation dialog, SHALL NOT cap turns, and SHALL NOT restrict tools. Agents run freely until the issue is done.

**Previous behavior**: Checked `autoWorkAssignments` (skipped if false), showed confirmation dialog when `autoWorkConfirmFirst` was true, passed `--max-turns` and `--allowed-tools` to Claude Code CLI.

#### Scenario: Auto-work triggers unconditionally
- **WHEN** an issue enters a trigger column (AI_SPEC or AI_CODE)
- **THEN** Claude Code is spawned to work on the issue immediately
- **AND** no confirmation dialog is shown
- **AND** no config check for `autoWorkAssignments` is performed
- **AND** no `--max-turns` flag is passed to the CLI
- **AND** no `--allowed-tools` flag is passed to the CLI

#### Scenario: Claude harness spawns without restrictions
- **WHEN** claudeHarness.run() is called
- **THEN** the Claude Code CLI is invoked without `--max-turns` argument
- **AND** the Claude Code CLI is invoked without `--allowed-tools` argument

#### Scenario: Claude spawner options have no restrictions
- **WHEN** claudeSpawner.spawn() is called
- **THEN** the options object does not include `maxTurns` or `allowedTools` fields
- **AND** the generated CLI command does not contain `--max-turns` or `--allowedTools` flags
