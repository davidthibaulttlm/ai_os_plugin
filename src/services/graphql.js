"use strict";
/** GitHub GraphQL client using built-in fetch (Node 20+) */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphQLClient = exports.GraphQLError = void 0;
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
/** GraphQL error from GitHub API */
class GraphQLError extends Error {
    constructor(errors) {
        super(`GraphQL error: ${JSON.stringify(errors)}`);
        this.errors = errors;
        this.name = 'GraphQLError';
    }
}
exports.GraphQLError = GraphQLError;
/** GitHub GraphQL client using built-in fetch */
class GraphQLClient {
    constructor(token) {
        this.token = token;
        this.endpoint = 'https://api.github.com/graphql';
    }
    /** Execute a GraphQL query or mutation with exponential backoff retry */
    async execute(query, variables, retryCount = 0) {
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
            const remaining = response.headers.get('X-RateLimit-Remaining');
            if (remaining) {
                // Rate limit info available in headers
            }
            // Retry on 403 (rate limit) or transient network errors
            if (!response.ok && (response.status === 403 || response.status >= 500) && retryCount < maxRetries) {
                const delay = Math.min(baseDelay * Math.pow(2, retryCount), 30000);
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
            return data.data;
        }
        catch (error) {
            // Retry on network errors (transient failures)
            if (retryCount < maxRetries && error instanceof Error && !error.message.includes('GraphQL error')) {
                const delay = Math.min(baseDelay * Math.pow(2, retryCount), 30000);
                console.error(`[AI OS] Network error retry ${retryCount + 1}/${maxRetries} after ${delay}ms: ${error.message}`);
                await new Promise((resolve) => setTimeout(resolve, delay));
                return this.execute(query, variables, retryCount + 1);
            }
            throw error;
        }
    }
    /** List all projects for the authenticated user */
    async listProjects() {
        const result = await this.execute(LIST_PROJECTS_QUERY);
        const projects = [...result.viewer.projectsV2.nodes];
        for (const org of result.viewer.organizations.nodes) {
            projects.push(...org.projectsV2.nodes);
        }
        return projects;
    }
    /** Get all items for a project board */
    async getProjectItems(projectId) {
        const items = [];
        let cursor = null;
        do {
            const result = await this.execute(GET_PROJECT_ITEMS_QUERY, {
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
    async getProjectFields(projectId) {
        const result = await this.execute(GET_PROJECT_FIELDS_QUERY, { id: projectId });
        return result.node.fields.nodes;
    }
    /** Move an item to a different column by fieldId and optionId */
    async moveItem(projectId, itemId, fieldId, optionId) {
        const result = await this.execute(UPDATE_ITEM_FIELD_MUTATION, {
            input: {
                projectId,
                itemId,
                fieldId,
                value: { singleSelectOptionId: optionId },
            },
        });
        return result.updateProjectV2ItemFieldValue.projectV2Item !== null;
    }
    /**
     * Move an item to a column by column name.
     * Resolves the fieldId and optionId from the project's field configuration.
     */
    async moveToColumn(projectId, itemId, columnName) {
        const fields = await this.getProjectFields(projectId);
        const statusField = fields.find((f) => f.name === 'Status' || f.options?.some((o) => o.name === columnName));
        if (!statusField || !statusField.options) {
            throw new Error(`Cannot find Status field or options for column: ${columnName}`);
        }
        const option = statusField.options.find((o) => o.name === columnName);
        if (!option) {
            throw new Error(`Column "${columnName}" not found in project fields`);
        }
        return this.moveItem(projectId, itemId, statusField.id, option.id);
    }
}
exports.GraphQLClient = GraphQLClient;
