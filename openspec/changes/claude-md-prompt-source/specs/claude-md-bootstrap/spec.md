## ADDED Requirements

### Requirement: RepoManager detects missing CLAUDE.md
The system SHALL report whether a cloned repo has a `CLAUDE.md` file by delegating to `RepoPromptService.hasCLAUDEmd()`.

#### Scenario: Repo has CLAUDE.md
- **WHEN** `hasCLAUDEmd(owner, repo)` is called on RepoManager for a cloned repo with `CLAUDE.md`
- **THEN** the method returns `true`

#### Scenario: Repo missing CLAUDE.md
- **WHEN** `hasCLAUDEmd(owner, repo)` is called on RepoManager for a cloned repo without `CLAUDE.md`
- **THEN** the method returns `false`

### Requirement: RepoManager creates CLAUDE.md template
The system SHALL create a `CLAUDE.md` file with a default template when requested by delegating to `RepoPromptService.createCLAUDEmdTemplate()`.

#### Scenario: Template created
- **WHEN** `createCLAUDEmd(owner, repo)` is called for a cloned repo without `CLAUDE.md`
- **THEN** the method writes a `CLAUDE.md` file at the repo root and returns `{ success: true }`

#### Scenario: Skips when file exists
- **WHEN** `createCLAUDEmd(owner, repo)` is called for a repo that already has `CLAUDE.md`
- **THEN** the method returns `{ success: false, error: 'CLAUDE.md already exists' }` without modifying the file

#### Scenario: Fails for uncloned repo
- **WHEN** `createCLAUDEmd(owner, repo)` is called for a repo that is not cloned
- **THEN** the method returns `{ success: false, error: 'Repo not cloned' }`

### Requirement: CLAUDE.md template contains useful default sections
The generated `CLAUDE.md` template SHALL include sections for project description, tech stack, coding conventions, and commands.

#### Scenario: Template has project description section
- **WHEN** `createCLAUDEmdTemplate(owner, repo)` generates a template
- **THEN** the file contains a "## Project" section with placeholder text

#### Scenario: Template has tech stack section
- **WHEN** `createCLAUDEmdTemplate(owner, repo)` generates a template
- **THEN** the file contains a "## Tech Stack" section with placeholder text

#### Scenario: Template has coding conventions section
- **WHEN** `createCLAUDEmdTemplate(owner, repo)` generates a template
- **THEN** the file contains a "## Coding Conventions" section with placeholder text
