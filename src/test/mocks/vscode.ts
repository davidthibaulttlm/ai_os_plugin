/**
 * Mock module for the VS Code API.
 * Used by Vitest to stub vscode imports during unit tests.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// --- Memento (globalState) ---
class MockMemento {
  private store = new Map<string, any>();

  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  async update<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }

  keys(): readonly string[] {
    return Array.from(this.store.keys());
  }
}

// --- LogOutputChannel ---
class MockLogOutputChannel {
  name = 'AI OS';

  trace(_message: string, ..._args: any[]): void {}
  debug(_message: string, ..._args: any[]): void {}
  info(_message: string, ..._args: any[]): void {}
  warn(_message: string, ..._args: any[]): void {}
  error(_message: string, ..._args: any[]): void {}
  append(_value: string): void {}
  appendLine(_value: string): void {}
  clear(): void {}
  show(_preserveFocus?: boolean): void {}
  hide(): void {}
  dispose(): void {}
}

// --- Window ---
const mockWindow = {
  createOutputChannel: (_name: string, options?: { log?: boolean }): MockLogOutputChannel => {
    return new MockLogOutputChannel();
  },
  showInformationMessage: async (_message: string, ..._items: string[]) => undefined as (string | undefined),
  showErrorMessage: async (_message: string, ..._items: string[]) => undefined as (string | undefined),
  createStatusBarItem: () => ({
    show: () => {},
    hide: () => {},
    dispose: () => {},
    text: '',
    tooltip: '',
    command: undefined,
  }),
  showQuickPick: async (_items: string[]) => undefined as (string | undefined),
  showInputBox: async () => undefined as (string | undefined),
  showWarningMessage: async (_message: string) => undefined as (string | undefined),
};

// --- Commands ---
const mockCommands = {
  executeCommand: async (_command: string, ..._args: any[]) => undefined as any,
  registerCommand: (_command: string, _callback: (...args: any[]) => any) => ({
    dispose: () => {},
  }),
};

// --- Workspace ---
const mockWorkspace = {
  getConfiguration: () => ({
    get: <T>(_key: string, _defaultValue?: T): T => undefined as any,
    update: async () => {},
    has: (_key: string) => false,
  }),
  findFiles: async () => [],
  getWorkspaceFolder: () => ({
    uri: { path: '/mock/workspace' },
    name: 'mock-workspace',
    index: 0,
  }),
};

// --- Uri ---
const mockUri = {
  parse: (_value: string) => ({ path: _value }),
  file: (_value: string) => ({ path: _value }),
};

// --- Environment ---
const mockEnv = {
  openExternal: async () => true,
  appName: 'Code',
  uiKind: { desktop: true, web: false },
};

// --- Disposable ---
const mockDisposable = {
  create: (_dispose: () => void) => ({ dispose: _dispose }),
};

// --- Progress ---
const mockProgressLocation = {
  WINDOW: 1,
  SOURCE_CONTROL: 3,
  TASK_PANEL: 15,
};

// --- Main module export ---
const vscode = {
  window: mockWindow,
  commands: mockCommands,
  workspace: mockWorkspace,
  Uri: mockUri,
  env: mockEnv,
  Disposable: mockDisposable,
  ProgressLocation: mockProgressLocation,
  // ExtensionContext mock
  ExtensionContext: class {
    globalState = new MockMemento();
    workspaceState = new MockMemento();
    extensionUri = { path: '/mock/extension' };
    storageUri = { path: '/mock/storage' };
    globalStorageUri = { path: '/mock/globalStorage' };
    secrets = {
      _store: new Map<string, string>(),
      get: async (_key: string) => undefined,
      store: async (_key: string, _value: string) => {},
      delete: async (_key: string) => {},
    };
  },
  // Enum values
  ConfigurationTarget: { GLOBAL: 1, WORKSPACE: 2, WORKSPACE_FOLDER: 3 },
  EndOfLine: { CRLF: 1, LF: 2 },
  TaskRevealKind: { Always: 1, Never: 2, Silent: 3 },
  UIKind: { desktop: 1, web: 2 },
};

export = vscode;
