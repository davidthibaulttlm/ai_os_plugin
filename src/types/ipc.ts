/** Messages from Webview → Extension */
export interface IPCMessage {
  type: string;
  data?: unknown;
}

export type WebviewToExtension =
  | { type: 'loadBoard'; data: { boardId: string } }
  | { type: 'moveItem'; data: { itemId: string; columnId: string } }
  | { type: 'reorderItem'; data: { itemId: string; afterId: string | null } }
  | { type: 'refresh'; data?: never }
  | { type: 'selectIssue'; data: { issueId: string } }
  | { type: 'assignAgent'; data: { issueId: string } };

/** Messages from Extension → Webview */
export type ExtensionToWebview =
  | { type: 'boardData'; data: BoardData }
  | { type: 'itemMoved'; data: MovedItem }
  | { type: 'itemReordered'; data: { itemId: string } }
  | { type: 'error'; data: { message: string } }
  | { type: 'agentProgress'; data: { issueId: string; status: string } }
  | { type: 'workingStatus'; data: { issueNumber: number; active: boolean } };

export interface BoardData {
  columns: { id: string; name: string; color: string }[];
  items: IssueItem[];
}

export interface IssueItem {
  id: string;
  type: 'ISSUE' | 'PULL_REQUEST';
  title: string;
  number: number;
  status: string;
  url: string;
  repo: string;
  priority?: string;
  labels?: string[];
}

export interface MovedItem {
  id: string;
  status: string;
}
