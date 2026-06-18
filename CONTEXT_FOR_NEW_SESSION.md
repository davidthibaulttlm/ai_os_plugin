# AI OS - Context for New Session

> **CRITICAL**: This document contains ALL context needed to continue development in a new session/repository. Read this entirely before starting work.

---

## 1. Product Vision

**AI OS** — A self-hosted AI agent system that connects to a user's GitHub account and automates their kanban workflow on **GitHub Projects v2 boards**.

- Users run this **locally on their own machine**
- Connects to **their own GitHub repos** via their own auth
- Tracks kanban boards (GitHub Projects v2) that aggregate issues/PRs from **many repos**
- AI agent automatically works on issues when they enter specific columns (e.g., `AI_CODE`)
- Delivered as a **VS Code extension** for seamless IDE integration

### Key Insight: GitHub Projects, NOT Repos

A **GitHub Project v2** is a kanban board that aggregates issues and PRs from multiple repositories. The app queries the **Project**, not individual repos. One project = one kanban board = items from many repos.

---

## 2. Architecture Decision: VS Code Extension

### Why VS Code Extension?

- **Eliminates webhook infrastructure**: No need for tunnels, public URLs, or ngrok/smee
- **User is already in the IDE**: Natural place for kanban management and AI agent interaction
- **Outbound actions are instant**: Moving cards, assigning agents = direct GraphQL mutations
- **Inbound changes use polling**: ~30s interval, acceptable since user is coding (not staring at board)

### Asymmetric Latency Model

| Direction | Action | Latency | User Perception |
|-----------|--------|---------|-----------------|
| **Outbound** | User moves card, assigns agent | **Instant** (GraphQL mutation) | Feels responsive |
| **Inbound** | Teammate changes, AI updates issue | **~30s** (GraphQL polling) | Acceptable (user is coding) |

### Extension Components

1. **Kanban Webview Panel** — React-based board view with drag-and-drop
2. **Command Palette Actions** — `AI OS: Assign Agent`, `AI OS: Move to AI_CODE`
3. **Background Poller** — 30s interval, queries project state via GraphQL
4. **GitHub Auth** — Reuses `gh` CLI token (no separate OAuth flow)
5. **Notification System** — Toast notifications for important events

---

## 3. Kanban Template (Fixed, Not Configurable)

Source: `https://github.com/orgs/justeDaveTV/projects/1/views/1`

**Status columns** (in order):
1. `BRAIN_DUMP` — Raw ideas, not yet specified
2. `AI_SPEC` — AI agent is writing the specification
3. `HUMAN_SPEC_REVIEW` — Human reviews the spec
4. `AI_CODE` — AI agent is coding the implementation
5. `HUMAN_CODE_REVIEW` — Human reviews the code
6. `PR_DONE` — Pull request merged, feature complete

**Additional fields**: Priority, Size (XS/S/M/L/XL), Assignees, Labels, Milestone, Repository, Reviewers, Parent issue, Sub-issues progress, Created/Updated/Closed, Estimate, Start date, Target date.

---

## 4. Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension | VS Code Extension API + React Webview |
| Backend | FastAPI (Python) |
| Database | PostgreSQL 16 (Docker) |
| Auth | GitHub OAuth 2.0 (or `gh` CLI token for extension) |
| API Client | `httpx` (async REST + GraphQL) |
| Package Manager | `uv` (Python), `npm` (frontend) |
| Containerization | Docker Compose |

---

## 5. GitHub Projects v2 API (GraphQL Only)

**GitHub Projects v2 is ONLY accessible via the GraphQL API. There is no REST API for Projects v2.**

### Official Documentation

- **Projects API Overview**: https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects
- **GraphQL Schema Reference**: https://docs.github.com/en/graphql/reference/projects
- **GraphQL Rate Limits**: https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api
- **GraphQL Reference (Types)**: https://docs.github.com/en/graphql/reference/object#projectv2
- **ProjectV2 Type**: https://docs.github.com/en/graphql/reference/object#projectv2
- **ProjectV2Item Type**: https://docs.github.com/en/graphql/reference/object#projectv2item
- **Webhook Events (projects_v2_item)**: https://docs.github.com/en/webhooks/webhook-events-and-payloads#projects_v2_item

### GraphQL Rate Limits

- **5,000 points per hour** (authenticated user)
- Cost is based on query complexity (nodes requested, connections traversed), NOT number of requests
- Minimum 1 point per query; a typical project items query costs ~5-15 points
- **2,000 points per minute** hard cap

### Polling Budget at 30-Second Intervals

| Metric | Value |
|--------|-------|
| Queries per hour | 120 |
| Estimated points per query | 5-15 |
| Points per hour | 600-1,800 |
| % of 5,000 limit | 12%-36% |
| Max projects simultaneously | 2-8 (depends on board size) |

### Key GraphQL Queries

**List all projects (user + orgs):**
```graphql
query {
  viewer {
    login
    projectsV2(first: 100) {
      nodes { id, title, url, number }
    }
    organizations(first: 100) {
      nodes { login }
    }
  }
}
```

**Get project items with Status field:**
```graphql
query($id: ID!, $after: String) {
  node(id: $id) {
    ... on ProjectV2 {
      items(first: 50, after: $after) {
        nodes {
          id
          type
          fieldValues(first: 10) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2FieldCommon { name } }
              }
            }
          }
          content {
            ... on Issue {
              id, number, title, url
              repository { id, name, owner { login } }
            }
            ... on PullRequest {
              id, number, title, url
              repository { id, name, owner { login } }
            }
          }
        }
        pageInfo { hasNextPage, endCursor }
      }
    }
  }
}
```

**Get project fields (columns):**
```graphql
query($id: ID!) {
  node(id: $id) {
    ... on ProjectV2 {
      fields(first: 20) {
        nodes {
          ... on ProjectV2SingleSelectField {
            name, id
            options { id, name }
          }
          ... on ProjectV2Field { name }
        }
      }
    }
  }
}
```

**Update item Status (move card):**
```graphql
mutation($input: UpdateProjectV2ItemFieldValueInput!) {
  updateProjectV2ItemFieldValue(input: $input) {
    success
  }
}
# Input: { projectId, itemId, fieldId, value: { singleSelectOptionId } }
```

**Add item to project:**
```graphql
mutation($input: AddProjectV2ItemByIdInput!) {
  addProjectV2ItemById(input: $input) {
    item { id }
  }
}
# Input: { projectId, contentId }
```

**Create new project:**
```graphql
mutation($input: CreateProjectV2Input!) {
  createProjectV2(input: $input) {
    project { id, name, url, number }
  }
}
```

**Add single-select field to project:**
```graphql
mutation($input: AddProjectV2SingleSelectFieldInput!) {
  addProjectV2SingleSelectField(input: $input) {
    field { ... on ProjectV2SingleSelectField { id, name } }
  }
}
```

### GitHub Webhook Events for Projects

GitHub supports `projects_v2_item` webhook events with actions:
- `created` — Item added to project
- `edited` — Item field values changed (including Status column moves)
- `deleted` — Item removed from project

Webhook payload includes the project item ID, field changes, and actor information.

**Webhook docs**: https://docs.github.com/en/webhooks/webhook-events-and-payloads#projects_v2_item

---

## 6. Database Schema

```sql
-- Users who logged in via GitHub
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    github_id       BIGINT UNIQUE NOT NULL,
    github_login    VARCHAR(255) NOT NULL,
    github_avatar   VARCHAR(500),
    access_token    TEXT NOT NULL,
    token_expires   TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Kanban boards (GitHub Projects V2)
CREATE TABLE boards (
    id                      SERIAL PRIMARY KEY,
    user_id                 INTEGER NOT NULL REFERENCES users(id),
    github_project_number   INT NOT NULL,
    github_node_id          VARCHAR(255),
    name                    VARCHAR(500) NOT NULL,
    url                     VARCHAR(500) NOT NULL,
    template_match          BOOLEAN DEFAULT FALSE,
    last_polled_at          TIMESTAMP,
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, github_project_number)
);

-- Issues/PRs tracked within boards
CREATE TABLE tracked_issues (
    id              SERIAL PRIMARY KEY,
    board_id        INTEGER NOT NULL REFERENCES boards(id),
    github_issue_id BIGINT NOT NULL,
    repo_id         BIGINT NOT NULL,
    issue_number    INT NOT NULL,
    title           TEXT,
    status          VARCHAR(50),
    url             VARCHAR(500),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(board_id, github_issue_id)
);

CREATE INDEX idx_tracked_issues_board_status ON tracked_issues(board_id, status);

-- Events: column changes, comments
CREATE TABLE events (
    id              SERIAL PRIMARY KEY,
    board_id        INTEGER NOT NULL REFERENCES boards(id),
    issue_id        INTEGER NOT NULL REFERENCES tracked_issues(id),
    event_type      VARCHAR(50) NOT NULL,
    event_data      JSONB NOT NULL,
    source_ref      TEXT,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_events_board ON events(board_id);
CREATE INDEX idx_events_issue ON events(issue_id);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_created ON events(created_at DESC);
CREATE UNIQUE INDEX idx_events_dedup ON events(issue_id, event_type, source_ref);
```

---

## 7. Event Detection Strategy

### Primary: Background Polling (30s interval)

- Queries the full project board state via GraphQL every 30 seconds
- Locally diffs against cached state to detect changes
- Detects: Status column moves, new items, field value changes
- **No webhook infrastructure needed** — works for every self-hosted user

### Delta Detection Approach

Since GraphQL returns the full board state each poll:
1. Store last known state in local DB (`tracked_issues` table with `status` column)
2. On each poll, compare returned items against stored state
3. Any difference = event (column change, new item, removed item)
4. Persist events, trigger AI agent if applicable

### Optional: Webhook Enhancement (Future)

If user has a public URL (VPS, domain):
- Configure GitHub org webhook for `projects_v2_item` events
- Instant column change detection
- Keep polling as reconciliation safety net

For local development only:
- smee.io: `npx smee -u https://smee.io/CHANNEL -t http://localhost:8000/api/webhook`
- ngrok: `ngrok http 8000`

---

## 8. AI Agent Workflow

```mermaid
stateDiagram-v2
    [*] --> BRAIN_DUMP
    BRAIN_DUMP --> AI_SPEC: User moves card
    AI_SPEC --> HUMAN_SPEC_REVIEW: AI completes spec
    HUMAN_SPEC_REVIEW --> AI_CODE: Human approves
    HUMAN_SPEC_REVIEW --> AI_SPEC: Human requests changes
    AI_CODE --> HUMAN_CODE_REVIEW: AI completes code
    HUMAN_CODE_REVIEW --> PR_DONE: Human approves
    HUMAN_CODE_REVIEW --> AI_CODE: Human requests changes
    PR_DONE --> [*]
```

**Agent triggers on column entry:**
- `AI_SPEC`: Generate technical specification from issue description
- `AI_CODE`: Generate code implementation from approved spec
- Agent writes output as comments on the issue (or updates issue body)

---

## 9. GitHub OAuth Scopes

Required scopes for the GitHub OAuth app:
- `repo` — Full access to repositories, issues, PRs
- `project` — Access to GitHub Projects v2
- `read:org` — Read organization membership

For `gh` CLI token authentication:
```bash
gh auth login --scopes gist,read:org,repo,workflow,project
```

---

## 10. Environment Variables

```bash
# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Database
DATABASE_URL=postgresql+asyncpg://kanban_bot:password@localhost:5432/kanban_bot

# Frontend
FRONTEND_URL=http://localhost:8000

# Session signing
SECRET_KEY=change-me-to-a-random-secret

# Polling interval (seconds)
POLL_INTERVAL=30

# Webhook secret (if using webhooks)
WEBHOOK_SECRET=change-me-to-a-random-webhook-secret
```

---

## 11. Key Design Decisions

1. **GitHub Projects v2, NOT repos** — One project aggregates items from many repos. We poll the project, not individual repos.
2. **VS Code extension delivery** — Eliminates webhook infrastructure. User is already in the IDE.
3. **Polling over webhooks for self-hosted** — 30s GraphQL polling works out of the box. No tunnel, no public URL needed.
4. **Asymmetric latency** — Outbound actions (user moves card) are instant. Inbound changes (teammate edits) have ~30s delay. Acceptable for kanban workflow.
5. **Fixed kanban template** — 6 columns, not configurable. Matches the AI agent workflow.
6. **GraphQL only for Projects** — Projects v2 has no REST API. All project operations use GraphQL.
7. **Async throughout** — `asyncpg`, `httpx`, async FastAPI, async SQLAlchemy.
8. **Delta detection via local diffing** — Store last known state, compare on each poll.

---

## 12. Existing Codebase Reference (AI_OS_v3)

The current repo (`AI_OS_v3`) is the web-based version (Vite + FastAPI + PostgreSQL). Key files:

- [`app/github/projects.py`](app/github/projects.py) — GraphQL queries/mutations for Projects v2
- [`app/github/templates.py`](app/github/templates.py) — Fixed kanban template constants
- [`app/github/client.py`](app/github/client.py) — GitHub API client (REST + GraphQL)
- [`app/db/models.py`](app/db/models.py) — SQLAlchemy ORM models
- [`app/events/handlers.py`](app/events/handlers.py) — Event processing logic
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — Full system architecture

The new repo will be a **VS Code extension** version of this same concept.

---

## 13. Official Reference Links

| Resource | URL |
|----------|-----|
| GitHub Projects API Docs | https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects |
| GraphQL API Reference | https://docs.github.com/en/graphql/reference/projects |
| GraphQL Rate Limits | https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api |
| ProjectV2 Object Type | https://docs.github.com/en/graphql/reference/object#projectv2 |
| ProjectV2Item Object Type | https://docs.github.com/en/graphql/reference/object#projectv2item |
| projects_v2_item Webhook Event | https://docs.github.com/en/webhooks/webhook-events-and-payloads#projects_v2_item |
| GitHub OAuth 2.0 | https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps |
| VS Code Extension API | https://code.visualstudio.com/api |
| VS Code Webview API | https://code.visualstudio.com/api/extension-guides/webview |
| `gh` CLI Authentication | https://cli.github.com/manual/gh_auth_login |

---

## 14. What the New Repo Should Build

A **VS Code extension** that:

1. Authenticates via `gh` CLI token (or inline OAuth)
2. Lists user's GitHub Projects v2 boards
3. Displays kanban board in a webview panel
4. Allows drag-and-drop to move items between columns (instant GraphQL mutation)
5. Polls project state every 30s for external changes
6. Triggers AI agent when issues enter `AI_SPEC` or `AI_CODE` columns
7. Shows AI agent progress in the IDE (notifications, output panel)
8. Stores local state in SQLite or PostgreSQL (Docker)
