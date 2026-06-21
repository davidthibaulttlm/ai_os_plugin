## ADDED Requirements

### Requirement: Agent output streams to webview via IPC
The harness SHALL post Claude process output to the webview using IPC message type `agentOutput`.

#### Scenario: Output line posted
- **WHEN** Claude process writes a line to stdout or stderr
- **THEN** the harness SHALL post `{ type: 'agentOutput', issueNumber: number, line: string, timestamp: number }` to the webview, where `timestamp` is Unix milliseconds (`Date.now()`)

#### Scenario: Output includes issue identifier
- **WHEN** multiple agents are running concurrently
- **THEN** each output message SHALL include the `issueNumber` field so the webview can route output to the correct card

### Requirement: Output is sanitized before rendering
All Claude output rendered in the webview SHALL be HTML-escaped to prevent XSS injection.

#### Scenario: HTML entities escaped
- **WHEN** Claude output contains `<script>` or other HTML tags
- **THEN** the webview SHALL render the text as escaped entities (`<script>`) not as executable HTML

#### Scenario: Sanitization applied on receive
- **WHEN** `agentOutput` IPC message arrives at the webview
- **THEN** the line SHALL be sanitized before being stored in `boardStore.agentOutputs`

### Requirement: Webview renders per-card output panel
The kanban webview SHALL display a collapsible output panel on each issue card that has an active agent session.

#### Scenario: Output panel appears on card
- **WHEN** an agent session starts for an issue
- **THEN** the corresponding `IssueCard` component SHALL show a collapsible output panel below the card content

#### Scenario: Output panel auto-scrolls
- **WHEN** new output lines arrive while the panel is scrolled to the bottom
- **THEN** the panel SHALL auto-scroll to keep the latest line visible

#### Scenario: Output panel collapses on completion
- **WHEN** the agent session completes (success or failure)
- **THEN** the output panel SHALL remain visible but collapsed, showing a summary badge (success/failure)

### Requirement: Output queue has backpressure handling
The harness SHALL limit the IPC output queue per session to prevent unbounded memory growth.

#### Scenario: Queue size limited
- **WHEN** the output queue for a session exceeds 500 pending messages
- **THEN** the harness SHALL drop the oldest messages to maintain the limit

#### Scenario: Normal flow unaffected
- **WHEN** the webview processes messages faster than Claude produces output
- **THEN** no messages SHALL be dropped

### Requirement: Output buffering for reconnection
The harness SHALL buffer the last 10KB of output per session using a circular line buffer. Buffer size is measured in bytes of joined line content.

#### Scenario: Buffer stores recent output
- **WHEN** Claude produces output exceeding 10KB
- **THEN** the buffer SHALL retain only the most recent 10KB, discarding older lines

#### Scenario: Replay on reconnect
- **WHEN** the webview reconnects (panel is recreated after VS Code focus loss, workspace switch, or manual close/reopen)
- **THEN** the harness SHALL replay buffered output for all active sessions via `agentOutput` messages
