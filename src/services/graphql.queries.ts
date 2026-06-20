/** GitHub GraphQL queries and type definitions */

// Shared GraphQL fragment for Issue/PullRequest content fields
export const CONTENT_FRAGMENT = `
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
`;

// GraphQL Queries
export const LIST_PROJECTS_QUERY = `
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

export const GET_PROJECT_ITEMS_QUERY = `
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
                ${CONTENT_FRAGMENT}
              }
              ... on PullRequest {
                ${CONTENT_FRAGMENT}
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

export const GET_PROJECT_FIELDS_QUERY = `
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

export const UPDATE_ITEM_FIELD_MUTATION = `
  mutation UpdateItemField($input: UpdateProjectV2ItemFieldValueInput!) {
    updateProjectV2ItemFieldValue(input: $input) {
      projectV2Item {
        id
      }
    }
  }
`;

export const UPDATE_ITEM_POSITION_MUTATION = `
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

export const GET_ISSUE_BY_NUMBER_QUERY = `
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
