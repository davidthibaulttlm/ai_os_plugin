interface VsCodeApi {
  postMessage(message: unknown): void;
  getState<T>(): T | undefined;
  setState<T>(state: T): T;
}

declare function acquireVsCodeApi(): VsCodeApi;

interface Window {
  acquireVsCodeApi?: () => VsCodeApi;
}

interface GlobalThis {
  acquireVsCodeApi?: () => VsCodeApi;
}
