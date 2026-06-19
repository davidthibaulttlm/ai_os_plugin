import * as vscode from 'vscode';
import type { GraphQLClient } from '../services/graphql';

/** Fixed column names matching the kanban template */
export const COLUMNS = {
  BRAIN_DUMP: 'BRAIN_DUMP',
  AI_SPEC: 'AI_SPEC',
  HUMAN_SPEC_REVIEW: 'HUMAN_SPEC_REVIEW',
  AI_CODE: 'AI_CODE',
  HUMAN_CODE_REVIEW: 'HUMAN_CODE_REVIEW',
  PR_DONE: 'PR_DONE',
} as const;

type ColumnName = typeof COLUMNS[keyof typeof COLUMNS];

/**
 * Move to column command — prompts for an item ID and moves it
 * to the specified column.
 */
export async function moveToColumn(
  graphql: GraphQLClient,
  projectId: string,
  targetColumn: ColumnName
): Promise<void> {
  const itemId = await vscode.window.showInputBox({
    prompt: `Enter the item ID to move to ${targetColumn}`,
    placeHolder: 'e.g., PVTI_lADO...',
    validateInput: (value: string) => {
      if (!value.trim()) {
        return 'Item ID is required';
      }
      return null;
    },
  });

  if (!itemId) {
    return;
  }

  try {
    await graphql.moveToColumn(projectId, itemId.trim(), targetColumn);
    vscode.window.showInformationMessage(
      `Item moved to ${targetColumn}`
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to move item: ${(error as Error).message}`
    );
  }
}
