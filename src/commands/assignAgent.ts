import * as vscode from 'vscode';
import type { GraphQLClient } from '../services/graphql';
import type { AgentService } from '../services/agent';

/**
 * Assign Agent command — prompts for an issue ID and triggers
 * the AI agent hook.
 */
export async function assignAgent(
  graphql: GraphQLClient,
  agentService: AgentService
): Promise<void> {
  const issueId = await vscode.window.showInputBox({
    prompt: 'Enter the issue number to assign an agent',
    placeHolder: 'e.g., 42',
    validateInput: (value: string) => {
      if (!value.trim()) {
        return 'Issue number is required';
      }
      if (!/^\d+$/.test(value.trim())) {
        return 'Issue number must be a positive integer';
      }
      return null;
    },
  });

  if (!issueId) {
    return;
  }

  try {
    await agentService.assignAgent(graphql, issueId.trim());
    vscode.window.showInformationMessage(
      `Agent assigned to issue #${issueId.trim()}`
    );
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to assign agent: ${(error as Error).message}`
    );
  }
}
