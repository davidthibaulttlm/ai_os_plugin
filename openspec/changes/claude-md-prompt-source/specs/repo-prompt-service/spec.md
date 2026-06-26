## ADDED Requirements

### Requirement: RepoPromptService checks CLAUDE.md existence
The system SHALL check whether a cloned repo contains a `CLAUDE.md` file at its root directory.

#### Scenario: Repo has CLAUDE.md
- **WHEN** `hasCLAUDEmd(owner, repo)` is called for a cloned repo containing `CLAUDE.md`
- **THEN** the method returns `true`

#### Scenario: Repo missing CLAUDE.md
- **WHEN** `hasCLAUDEmd(owner, repo)` is called for a cloned repo without `CLAUDE.md`
- **THEN** the method returns `false`

#### Scenario: Repo not cloned
- **WHEN** `hasCLAUDEmd(owner, repo)` is called for a repo that is not cloned
- **THEN** the method returns `false`

#### Scenario: Empty CLAUDE.md is treated as missing
- **WHEN** `hasCLAUDEmd(owner, repo)` is called and `CLAUDE.md` exists but contains only whitespace
- **THEN** the method returns `false`

### Requirement: RepoPromptService checks AGENTS.md existence
The system SHALL check whether a cloned repo contains an `AGENTS.md` file at its root directory.

#### Scenario: Repo has AGENTS.md
- **WHEN** `hasAGENTSmd(owner, repo)` is called for a cloned repo containing `AGENTS.md`
- **THEN** the method returns `true`

#### Scenario: Repo missing AGENTS.md
- **WHEN** `hasAGENTSmd(owner, repo)` is called for a cloned repo without `AGENTS.md`
- **THEN** the method returns `false`

#### Scenario: Repo not cloned
- **WHEN** `hasAGENTSmd(owner, repo)` is called for a repo that is not cloned
- **THEN** the method returns `false`

#### Scenario: Empty AGENTS.md is treated as missing
- **WHEN** `hasAGENTSmd(owner, repo)` is called and `AGENTS.md` exists but contains only whitespace
- **THEN** the method returns `false`

### Requirement: RepoPromptService reads CLAUDE.md content
The system SHALL read and return the content of `CLAUDE.md` from a cloned repo's root.

#### Scenario: Successful read
- **WHEN** `getCLAUDEmd(owner, repo)` is called for a repo with `CLAUDE.md`
- **THEN** the method returns the file content as a string

#### Scenario: File read error
- **WHEN** `getCLAUDEmd(owner, repo)` is called but the file cannot be read
- **THEN** the method returns `null` and logs the error

### Requirement: RepoPromptService reads AGENTS.md content
The system SHALL read and return the content of `AGENTS.md` from a cloned repo's root.

#### Scenario: Successful read
- **WHEN** `getAGENTSmd(owner, repo)` is called for a repo with `AGENTS.md`
- **THEN** the method returns the file content as a string

#### Scenario: File read error
- **WHEN** `getAGENTSmd(owner, repo)` is called but the file cannot be read
- **THEN** the method returns `null` and logs the error

### Requirement: RepoPromptService caches file content
The system SHALL cache CLAUDE.md and AGENTS.md content in-memory to avoid repeated filesystem reads.

#### Scenario: Cache hit
- **WHEN** `getCLAUDEmd(owner, repo)` is called twice without the file changing on disk
- **THEN** the second call returns the cached content without reading the filesystem

#### Scenario: Cache invalidation on file change
- **WHEN** `getCLAUDEmd(owner, repo)` is called after the file modification time has changed
- **THEN** the method re-reads the file and updates the cache

### Requirement: RepoPromptService generates CLAUDE.md template
The system SHALL generate a default `CLAUDE.md` template file when requested for a repo without one.

#### Scenario: Template created successfully
- **WHEN** `createCLAUDEmdTemplate(owner, repo)` is called for a cloned repo without `CLAUDE.md`
- **THEN** the method creates `CLAUDE.md` at the repo root with default template content and returns `true`

#### Scenario: Template not created when file exists
- **WHEN** `createCLAUDEmdTemplate(owner, repo)` is called for a repo that already has `CLAUDE.md`
- **THEN** the method returns `false` without modifying the existing file

#### Scenario: Template not created for uncloned repo
- **WHEN** `createCLAUDEmdTemplate(owner, repo)` is called for a repo that is not cloned
- **THEN** the method returns `false`
