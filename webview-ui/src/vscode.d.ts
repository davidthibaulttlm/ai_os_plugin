/**
 * Type declarations for VS Code webview API.
 * acquireVsCodeApi provides secure communication between
 * the webview and extension host.
 */
interface VsCodeApi {
  postMessage(message: unknown): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): T;
}

declare function acquireVsCodeApi(): VsCodeApi;
