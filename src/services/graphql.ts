// Re-exports for backward compatibility - all imports from './graphql' continue to work
export {
  CONTENT_FRAGMENT,
  LIST_PROJECTS_QUERY,
  GET_PROJECT_ITEMS_QUERY,
  GET_PROJECT_FIELDS_QUERY,
  UPDATE_ITEM_FIELD_MUTATION,
  UPDATE_ITEM_POSITION_MUTATION,
  GET_ISSUE_BY_NUMBER_QUERY,
  GraphQLError,
  type IssueDetails,
  type GetIssueByNumberResponse,
  type ProjectNode,
  type ListProjectsResponse,
  type FieldValue,
  type IssueContent,
  type ProjectItemNode,
  type GetProjectItemsResponse,
  type FieldOption,
  type ProjectField,
  type GetProjectFieldsResponse,
  type UpdateItemFieldResponse,
  type UpdateItemPositionResponse,
} from './graphql.queries';

export { GraphQLClient } from './graphql.client';
