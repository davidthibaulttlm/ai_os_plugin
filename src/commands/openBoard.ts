import * as vscode from 'vscode';
import { KanbanPanel } from '../providers/KanbanPanel';
import type { GraphQLClient } from '../services/graphql';
import type { StateManager } from '../services/state';
import type { ColumnPromptService } from '../services/columnPrompt';
import type { RepoManager } from '../services/repoManager';
import type { RepoPromptService } from '../services/repoPrompt';

/** Panel creation callback */
export type PanelCallback = (panel: KanbanPanel) => void;

/**
 * Open Board command — shows a quick-pick list of GitHub projects
 * and opens the selected one in the Kanban panel.
 */
export async function openBoard(
  extensionUri: vscode.Uri,
  graphql: GraphQLClient,
  stateManager: StateManager,
  promptService: ColumnPromptService,
  onPanelCreated?: PanelCallback,
  repoManager?: RepoManager,
  repoPromptService?: RepoPromptService
): Promise<void> {
  try {
    const projects = await graphql.listProjects();

    if (projects.length === 0) {
      vscode.window.showInformationMessage(
        'No GitHub Projects found. Create a project at https://github.com/projects'
      );
      return;
    }

    const picks: vscode.QuickPickItem[] = projects.map((p) => ({
      label: p.title,
      description: `#${p.number}`,
      detail: p.url,
    }));

    const selected = await vscode.window.showQuickPick(picks, {
      placeHolder: 'Select a GitHub Project to open as a kanban board',
    });

    if (!selected) {
      return;
    }

    // Find the project ID for the selected item
    const project = projects.find(
      (p) => p.title === selected.label
    );
    if (!project) {
      return;
    }

    await stateManager.setLastBoardId(project.id);

    const panel = KanbanPanel.createOrShow(extensionUri, graphql, promptService, repoManager, repoPromptService, project.id);
    onPanelCreated?.(panel);
  } catch (error) {
    vscode.window.showErrorMessage(
      `Failed to load projects: ${(error as Error).message}`
    );
  }
}
