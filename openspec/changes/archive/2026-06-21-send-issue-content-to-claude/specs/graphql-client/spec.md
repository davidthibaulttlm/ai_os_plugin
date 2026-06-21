## MODIFIED Requirements

### Requirement: CONTENT_FRAGMENT includes body field
The `CONTENT_FRAGMENT` GraphQL fragment SHALL include the `body` field for Issue and PullRequest types, ensuring issue descriptions are fetched during board polls.

#### Scenario: Fragment fetches body
- **WHEN** the GraphQL query executes with `CONTENT_FRAGMENT`
- **THEN** the response includes the `body` field for each issue/PR

### Requirement: IssueContent type includes body
The `IssueContent` interface SHALL include an optional `body` field of type `string | undefined`.

#### Scenario: Type includes body
- **WHEN** a GraphQL response is typed as `IssueContent`
- **THEN** the `body` property is accessible as an optional string
