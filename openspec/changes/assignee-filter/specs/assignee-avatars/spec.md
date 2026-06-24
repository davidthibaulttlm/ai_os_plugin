## ADDED Requirements

### Requirement: IssueCard displays assignee avatar circles
The `IssueCard` webview component SHALL render assignee avatar circles for each assignee on the issue. Each avatar SHALL be a circular image (24x24px) using the GitHub-provided `avatarUrl`.

#### Scenario: Card shows multiple assignees
- **WHEN** an issue has 3 assignees with avatar URLs
- **THEN** the card SHALL display 3 avatar circles in a horizontal row

#### Scenario: Card shows no assignees
- **WHEN** an issue has no assignees
- **THEN** the card SHALL display no avatar circles (no placeholder)

#### Scenario: Avatar uses GitHub avatarUrl
- **WHEN** an assignee has `avatarUrl: "https://avatars.githubusercontent.com/u/123?v=4"`
- **THEN** the avatar image `src` SHALL use that URL directly

### Requirement: PrioritizerItem includes assignees with avatar URLs
The `PrioritizerItem` interface SHALL include an `assignees` field of type `{ login: string; avatarUrl: string }[]`.

#### Scenario: Item has assignees from poll
- **WHEN** the poller creates `PrioritizerItem` from a GraphQL result with assignees
- **THEN** the item SHALL include `assignees` with `login` and `avatarUrl` for each assignee

#### Scenario: Item has no assignees from poll
- **WHEN** the GraphQL result has an empty assignees list
- **THEN** the item SHALL include `assignees: []`

### Requirement: KanbanBoard passes assignees to IssueCard
The `KanbanBoard` component SHALL pass the `assignees` prop to each `IssueCard` when rendering board items.

#### Scenario: Board renders cards with assignee data
- **WHEN** the board receives items with assignee data
- **THEN** each `IssueCard` SHALL receive the `assignees` prop
