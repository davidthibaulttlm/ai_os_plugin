import * as vscode from 'vscode';

declare module 'vscode' {
  namespace lm {
    function registerMcpServerDefinitionProvider(
      id: string,
      provider: { provideMcpServerDefinitions: () => McpServerDefinition[] }
    ): vscode.Disposable;
  }

  interface McpServerDefinition {
    id: string;
    label: string;
    command: string;
    args: string[];
    env: Record<string, string>;
  }
}
