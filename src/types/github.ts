import type { FieldOption } from '../services/graphql';

/** GitHub Project representation */
export interface GitHubProject {
  id: string;
  title: string;
  url: string;
  number: number;
  owner?: string;
}

/** Project field definition */
export interface ProjectField {
  id: string;
  name: string;
  options?: FieldOption[];
}

/** Column mapping: field option ID → our column name */
export interface ColumnMapping {
  projectId: string;
  statusFieldId: string;
  options: Record<string, string>;
}

/** Board item from GraphQL response */
export interface BoardItemRaw {
  id: string;
  databaseId: number | null;
  type: 'ISSUE' | 'PULL_REQUEST';
  content: IssueContent | PullRequestContent;
  fieldValues: FieldValue[];
}

/** Issue content from project item */
export interface IssueContent {
  id: string;
  number: number;
  title: string;
  url: string;
  state: string;
  repository: RepositoryRef;
  labels: { nodes: { name: string; color: string }[] };
  assignees: { nodes: { login: string; avatarUrl: string }[] };
}

/** Pull Request content from project item */
export interface PullRequestContent {
  id: string;
  number: number;
  title: string;
  url: string;
  state: string;
  repository: RepositoryRef;
  labels: { nodes: { name: string; color: string }[] };
  assignees: { nodes: { login: string; avatarUrl: string }[] };
}

/** Repository reference */
export interface RepositoryRef {
  id: string;
  name: string;
  owner: { login: string };
}

/** Field value on a project item */
export interface FieldValue {
  name: string;
  field: { name: string; id: string };
  text?: string;
  number?: number;
  date?: string;
}
