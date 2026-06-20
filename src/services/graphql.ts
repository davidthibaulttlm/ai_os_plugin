/** GitHub GraphQL client using built-in fetch (Node 20+) */

import { logger } from './logger';

// GraphQL Queries
const LIST_PROJECTS_QUERY = `
  query ListProjects($first: Int = 100) {
    viewer {
      login
      projectsV2(first: $first) {
        nodes {
          id
          title
          url
          number
        }
      }
      organizations(first: 100) {
        nodes {
          login
          projectsV2(first: $first) {
            nodes {
              id
              title
              url
              number
            }
          }
        }
      }
    }
  }
`;

const GET_PROJECT_ITEMS_QUERY = `
  query GetProjectItems($id: ID!, $after: String) {
    node(id: $id) {
      ... on ProjectV2 {
        title
        url
        number
        items(first: 50, after: $after) {
          nodes {
            id
            databaseId
            type
            fieldValues(first: 20) {
              nodes {
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  id
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                      id
                    }
                  }
                }
                ... on ProjectV2ItemFieldTextValue {
                  text
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                      id
                    }
                  }
                }
                ... on ProjectV2ItemFieldNumberValue {
                  number
                  field {
                    ... on ProjectV2FieldCommon {
                      name
                      id
                    }
                  }
                }
              }
            }
            content {
              ... on Issue {
                id
                number
                title
                url
                state
                repository {
                  id
                  name
                  owner { login }
                }
                labels(first: 10) {
                  nodes { name, color }
                }
              }
              ... on PullRequest {
                id
                number
                title
                url
                state
                repository {
                  id
                  name
                  owner { login }
                }
                labels(first: 10) {
                  nodes { name, color }
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

const GET_PROJECT_FIELDS_QUERY = `
  query GetProjectFields($id: ID!) {
    node(id: $id) {
      ... on ProjectV2 {
        fields(first: 30) {
          nodes {
            ... on ProjectV2SingleSelectField {
              name
              id
              options {
                id
                name
                color
              }
            }
            ... on ProjectV2Field {
              name
              id
            }
          }
        }
      }
    }
  }
`;

const UPDATE_ITEM_FIELD_MUTATION = `
  mutation UpdateItemField($input: UpdateProjectV2ItemFieldValueInput!) {
    updateProjectV2ItemFieldValue(input: $input) {
      projectV2Item {
        id
      }
    }
  }
`;

const UPDATE_ITEM_POSITION_MUTATION = `
  mutation UpdateItemPosition($input: UpdateProjectV2ItemPositionInput!) {
    updateProjectV2ItemPosition(input: $input) {
      items(first: 1) {
        nodes {
          id
        }
      }
    }
  }
`;

const GET_ISSUE_BY_NUMBER_QUERY = `
  query GetIssueByNumber($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) {
        id
        number
        title
        body
        url
        state
        labels(first: 10) {
          nodes { name, color }
        }
        assignees(first: 5) {
          nodes { login }
        }
      }
    }
  }
`;

export interface IssueDetails {
  id: string;
  number: number;
  title: string;
  body: string;
  url: string;
  state: string;
  labels: { name: string; color: string }[];
  assignees: { login: string }[];
}

export interface GetIssueByNumberResponse {
  repository: {
    issue: IssueDetails & {
      labels: { nodes: { name: string; color: string }[] };
      assignees: { nodes: { login: string }[] };
    } | null;
  } | null;
}

// Response types
export interface ProjectNode {
  id: string;
  title: string;
  url: string;
  number: number;
}

export interface ListProjectsResponse {
  viewer: {
    login: string;
    projectsV2: { nodes: ProjectNode[] };
    organizations: {
      nodes: {
        login: string;
        projectsV2: { nodes: ProjectNode[] };
      }[];
    };
  };
}

export interface FieldValue {
  name: string;
  id?: string;
  text?: string;
  number?: number;
  field: { name: string; id: string };
}

export interface IssueContent {
  id: string;
  number: number;
  title: string;
  url: string;
  state: string;
  repository: { id: string; name: string; owner: { login: string } };
  labels: { nodes: { name: string; color: string }[] };
}

export interface ProjectItemNode {
  id: string;
  databaseId: number | null;
  type: 'ISSUE' | 'PULL_REQUEST';
  fieldValues: { nodes: FieldValue[] };
  content: IssueContent | null;
}

export interface GetProjectItemsResponse {
  node: {
    title: string;
    url: string;
    number: number;
    items: {
      nodes: ProjectItemNode[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
}

export interface FieldOption {
  id: string;
  name: string;
  color?: string;
}

export interface ProjectField {
  name: string;
  id: string;
  options?: FieldOption[];
}

export interface GetProjectFieldsResponse {
  node: {
    fields: { nodes: ProjectField[] };
  };
}

export interface UpdateItemFieldResponse {
  updateProjectV2ItemFieldValue: { projectV2Item: { id: string } | null };
}

export interface UpdateItemPositionResponse {
  updateProjectV2ItemPosition: { items: { nodes: { id: string }[] } };
}

/** GraphQL error from GitHub API */
export class GraphQLError extends Error {
  constructor(public errors: unknown[]) {
    super(`GraphQL error: ${JSON.stringify(errors)}`);
    this.name = 'GraphQLError';
  }
}

/** GitHub GraphQL client using built-in fetch */
export class GraphQLClient {
  private readonly endpoint = 'https://api.github.com/graphql';

  constructor(private readonly token: string) {}

  /** Execute a GraphQL query or mutation with exponential backoff retry */
  public async execute<T>(
    query: string,
    variables?: Record<string, unknown>,
    retryCount: number = 0
  ): Promise<T> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second base delay
    const fetchTimeout = 15000; // 15 second timeout per request

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), fetchTimeout);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({ query, variables: variables ?? {} }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));

      // Parse rate limit headers
      const remaining = response.headers.get('X-RateLimit-Remaining');
      if (remaining) {
        logger.debug(`Rate limit remaining: ${remaining}`);
      }

      // Retry on 403 (rate limit) or transient network errors
      if (!response.ok && (response.status === 403 || response.status >= 500) && retryCount < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, retryCount), 30000);
        logger.debug(`Retry ${retryCount + 1}/${maxRetries} after ${delay}ms (status: ${response.status})`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.execute(query, variables, retryCount + 1);
      }

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      if (data.errors) {
        throw new GraphQLError(data.errors);
      }
      return data.data as T;
    } catch (error) {
      // Retry on network errors (transient failures)
      if (retryCount < maxRetries && error instanceof Error && !error.message.includes('GraphQL error')) {
        const delay = Math.min(baseDelay * Math.pow(2, retryCount), 30000);
        logger.debug(`Network error retry ${retryCount + 1}/${maxRetries} after ${delay}ms: ${error.message}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.execute(query, variables, retryCount + 1);
      }
      throw error;
    }
  }

  /** List all projects for the authenticated user */
  public async listProjects(): Promise<ProjectNode[]> {
    const result = await this.execute<ListProjectsResponse>(LIST_PROJECTS_QUERY);
    const projects: ProjectNode[] = [...result.viewer.projectsV2.nodes];

    for (const org of result.viewer.organizations.nodes) {
      projects.push(...org.projectsV2.nodes);
    }

    return projects;
  }

  /** Get all items for a project board */
  public async getProjectItems(projectId: string): Promise<ProjectItemNode[]> {
    const items: ProjectItemNode[] = [];
    let cursor: string | null = null;

    do {
      const result: GetProjectItemsResponse = await this.execute<GetProjectItemsResponse>(GET_PROJECT_ITEMS_QUERY, {
        id: projectId,
        after: cursor ?? undefined,
      });

      items.push(...result.node.items.nodes);
      cursor = result.node.items.pageInfo.hasNextPage
        ? result.node.items.pageInfo.endCursor
        : null;
    } while (cursor);

    return items;
  }

  /** Get project fields (for column mapping) */
  public async getProjectFields(projectId: string): Promise<ProjectField[]> {
    const result = await this.execute<GetProjectFieldsResponse>(
      GET_PROJECT_FIELDS_QUERY,
      { id: projectId }
    );
    return result.node.fields.nodes;
  }

  /** Move an item to a different column by fieldId and optionId */
  public async moveItem(
    projectId: string,
    itemId: string,
    fieldId: string,
    optionId: string
  ): Promise<boolean> {
    const result = await this.execute<UpdateItemFieldResponse>(
      UPDATE_ITEM_FIELD_MUTATION,
      {
        input: {
          projectId,
          itemId,
          fieldId,
          value: { singleSelectOptionId: optionId },
        },
      }
    );
    return result.updateProjectV2ItemFieldValue.projectV2Item !== null;
  }

  /**
   * Move an item to a column by column name.
   * Resolves the fieldId and optionId from the project's field configuration.
   */
  public async moveToColumn(
    projectId: string,
    itemId: string,
    columnName: string
  ): Promise<boolean> {
    const fields = await this.getProjectFields(projectId);
    const statusField = fields.find(
      (f) => f.name === 'Status' || f.options?.some((o) => o.name === columnName)
    );

    if (!statusField || !statusField.options) {
      throw new Error(`Cannot find Status field or options for column: ${columnName}`);
    }

    const option = statusField.options.find((o) => o.name === columnName);
    if (!option) {
      throw new Error(`Column "${columnName}" not found in project fields`);
    }

    return this.moveItem(projectId, itemId, statusField.id, option.id);
  }

  /**
   * Reorder an item within the project using updateProjectV2ItemPosition.
   * `afterId` is the item ID to place this item after. If null/undefined, moves to top.
   */
  public async reorderItem(
    projectId: string,
    itemId: string,
    afterId: string | null | undefined
  ): Promise<boolean> {
    const result = await this.execute<UpdateItemPositionResponse>(
      UPDATE_ITEM_POSITION_MUTATION,
      {
        input: {
          projectId,
          itemId,
          afterId: afterId ?? null,
        },
      }
    );
    return result.updateProjectV2ItemPosition.items.nodes.length > 0;
  }

  /**
   * Fetch a single issue by repository owner, name, and issue number.
   * Used by the MCP get_issue_details tool.
   */
  public async getIssueByNumber(
    owner: string,
    repo: string,
    issueNumber: number
  ): Promise<IssueDetails | null> {
    const result = await this.execute<GetIssueByNumberResponse>(GET_ISSUE_BY_NUMBER_QUERY, {
      owner,
      repo,
      number: issueNumber,
    });

    const issue = result.repository?.issue;
    if (!issue) return null;

    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body,
      url: issue.url,
      state: issue.state,
      labels: issue.labels.nodes.map((l) => ({ name: l.name, color: l.color })),
      assignees: issue.assignees.nodes.map((a) => ({ login: a.login })),
    };
  }
}
